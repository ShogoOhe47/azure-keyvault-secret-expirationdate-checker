/*
 * === Azure App Service Certificate Expiration date checker ===
 * This functions collect certificate expiration date from "secret" stored in the Azure Key Vault.
 * It will report that via email.
 * 
 * Report the status of the expiration date based on the threshold.
 *  - info  : No problem. The certificate is valid for more than the threshold.
 *  - warn  : The certificate is valid, but the number of days it is valid is below the threshold.
 *  - error : The certificate is already expired.
 */

const { DefaultAzureCredential } = require("@azure/identity");
const { SecretClient } = require("@azure/keyvault-secrets");

module.exports = async function (context, myTimer) {
    context.log("Key Vault: secret expiration date checker start working");

    // Load environment variable
    const keyVaultName = process.env["KEY_VAULT_NAME"];
    const KVUri = "https://" + keyVaultName + ".vault.azure.net";
  
    const credential = new DefaultAzureCredential();
    const client = new SecretClient(KVUri, credential);
    
    const SECRET_EXPIRATIONDATE_THRESHOLD = process.env["SECRET_EXPIRATIONDATE_THRESHOLD"] === undefined ? 50 : process.env["SECRET_EXPIRATIONDATE_THRESHOLD"];
    context.log("SECRET_EXPIRATIONDATE_THRESHOLD  " + SECRET_EXPIRATIONDATE_THRESHOLD);
    
    var secret_list_info = [];
    var secret_list_warn = [];
    var secret_list_expire = [];
    
    // collect secret information
    for await (const secretProperties of client.listPropertiesOfSecrets()) {
        const secret = await client.getSecret(secretProperties.name);

        // parse secret info
        const secret_name = secret.name;
        const secret_expiresOn = secret.properties.expiresOn;
        const secret_CertificateId = secret.properties.tags.CertificateId;
  
        // about expiration date
        const expire_time_inms = Date.parse(secret_expiresOn);
        const current_datetime_inms = Date.now();
        // remaining date
        const remaining_time_inms = expire_time_inms - current_datetime_inms;
        const remaining_time_indays = remaining_time_inms / (24 * 60 * 60 * 1000);
        //console.log("Remaining Date : " + remaining_time_indays);
  
        // Resource name of App Service Certifiticate
        // [tag: CertificateId] = /subscriptions/../resourceGroups/../providers/Microsoft.CertificateRegistration/certificateOrders/../certificates/<cert-name>
        //  -> ["subscriptions", "..", "resourceGroups", .., "<cert-name>"]
        const certificateid_elem = secret_CertificateId.split('/');
        const appservice_cert_name = certificateid_elem[certificateid_elem.length-1];
        //console.log("Resouce Name : " + certificateid_elem[certificateid_elem.length-1] );
  
        // build result object
        const secret_obj = {
            name: secret_name,
            expiresOn: secret_expiresOn,
            CertificateId: secret_CertificateId,
            remaining_time_inms: remaining_time_inms,
            remaining_time_indays: remaining_time_indays,
            appservice_cert_name: appservice_cert_name
        }
  
        // classification and add to each list -> info/warn/error
        if (secret_obj.remaining_time_indays <= 0){
          secret_list_expire.push(secret_obj);
        }else if(secret_obj.remaining_time_indays < SECRET_EXPIRATIONDATE_THRESHOLD){
          secret_list_warn.push(secret_obj)
        }else{
          secret_list_info.push(secret_obj)
        }
    }


    // build result message : create table
    responseMessage = ""
    if (secret_list_expire.length > 0) {
        var line = "# These secrets have expired. (" + secret_list_expire.length + " items)";
        context.log(line);
        responseMessage += line + "\n";

        var table = table_format(secret_list_expire);
        responseMessage += table + "\n\n";
    }
    if (secret_list_warn.length > 0) {
        var line = "# These secrets are nearing expiration. (THRESHOLD:" + SECRET_EXPIRATIONDATE_THRESHOLD + " days, " + secret_list_warn.length + " items)";
        context.log(line);
        responseMessage += line + "\n";

        var table = table_format(secret_list_warn);
        responseMessage += table + "\n\n";
    }
    if (secret_list_info.length > 0) {
        var line = "# There's nothing wrong with these secrets. (" + secret_list_info.length + " items)";
        context.log(line);
        responseMessage += line + "\n";

        var table = table_format(secret_list_info);
        responseMessage += table + "\n\n";
    }

  // send e-mail
  context.bindings.message = {
    "personalizations": [
      {
        "to": [
          {
            "email": process.env["SENDGRID_ADDR_TO"]
          }
        ],
        "subject": "Azure Key Vault: secret expiration check"
      }
    ],
    "from": {
      "email": process.env["SENDGRID_ADDR_FROM"]
    },
    "content": [
      {
        "type": "text/plain",
        "value": responseMessage
      }
    ]
};
};

function table_format(array_of_secret_obj){
    let return_report = "";
  
    // build header
    return_report += "Expire Date                                   | Remaining Date | secret name | App Service Certificate Name" + "\n";
  
    for (const secret_obj of array_of_secret_obj) {
        return_report += secret_obj.expiresOn + " | " + secret_obj.remaining_time_indays.toFixed(1) + " | " + secret_obj.name + " | " + secret_obj.appservice_cert_name +" |\n";
    }
  
    return return_report;
  }