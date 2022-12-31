const { SecretClient } = require("@azure/keyvault-secrets");
const { CertificateClient } = require("@azure/keyvault-certificates");
const { DefaultAzureCredential } = require("@azure/identity");

module.exports = async function (context, myTimer) {
    var timeStamp = new Date().toISOString();
    
    if (myTimer.isPastDue)
    {
        context.log('JavaScript is running late!');
    }
    context.log('JavaScript timer trigger function ran!', timeStamp);

    // create kv connection url
    context.log('Start connect to KeyVault.');
    const credential = new DefaultAzureCredential();
    const keyVaultName = process.env["KEYVAULT_NAME"];
    const url = "https://" + keyVaultName + ".vault.azure.net";
    const secretclient = new SecretClient(url, credential);
    const certificateclient = new CertificateClient(url, credential);
    console.log("KeyVault: "+ keyVaultName +", "+url)

    // list Secrets
    context.log('Collect KeyVault Secrets info...');
    kvSecretArray = [];
    for await (const secretProperties of secretclient.listPropertiesOfSecrets()) {
        // Read the secret we created
        const secret = await secretclient.getSecret(secretProperties.name);

        // parse secret info
        const secret_name = secret.name;
        const secret_expiresOn = Date.parse(secret.properties.expiresOn);
        const secret_certificateId = secret.properties.tags.CertificateId;

        // set object and add to array
        secret_obj = new Secret(secret_name, secret_expiresOn, secret_certificateId);
        kvSecretArray.push(secret_obj);
    }
    // debug:Secret
    // for (item of kvSecretArray){
    //     console.log(item);
    // }
    // console.log(kvSecretArray);

    // list Certificates
    context.log('Collect KeyVault Certificates info...');
    kvCertificateArray = [];
    for await (const certificateProperties of certificateclient.listPropertiesOfCertificates()) {
        // Read the secret we created
        const certificate = await certificateclient.getCertificate(certificateProperties.name);

        // parse secret info
        const certificate_name = certificate.name;
        const certificate_expiresOn = Date.parse(certificate.properties.expiresOn);
        const certificate_Subject = certificate.policy.subject;

        // set object and add to array
        cert_obj = new Certificate(certificate_name, certificate_expiresOn, certificate_Subject);
        kvCertificateArray.push(cert_obj);
    }
    // debug:Certificate
    // for (item of kvCertificateArray){
    //     console.log(item);
    // }


    const current_datetime = Date.now();
    const thresholdInMillsecounds = process.env["EXPIRATION_THRESHOLD_INDAYS"] * 86400000; // 1day in ms = 24 hour * 60min * 60 sec * 1000
    // console.log(thresholdInMillsecounds)
    const threshold_datetime = current_datetime + thresholdInMillsecounds;

    // sort secret by expiration date
    secret_array_info = []; // Days remaining > EXPIRATIONDATE_THRESHOLD 
    secret_array_warn = []; // Days remaining < EXPIRATIONDATE_THRESHOLD
    secret_array_expire = []; // Already Expire

    secret_array_info = kvSecretArray.filter(secret => {
        return secret.expirationDate > threshold_datetime; // has enough date
    });
    // console.log("secret_array_info");
    // console.log(secret_array_info);

    secret_array_warn = kvSecretArray.filter(secret => {
        return secret.expirationDate > current_datetime && secret.expirationDate < threshold_datetime;
    });
    // console.log("secret_array_warn");
    // console.log(secret_array_warn);

    secret_array_expire = kvSecretArray.filter(secret => {
        return secret.expirationDate < current_datetime;
    });
    // console.log("secret_array_expire");
    // console.log(secret_array_expire);


    // sort certificate by expiration date
    certificate_array_info = []; // Days remaining > EXPIRATIONDATE_THRESHOLD 
    certificate_array_warn = []; // Days remaining < EXPIRATIONDATE_THRESHOLD
    certificate_array_expire = []; // Already Expire

    certificate_array_info = kvCertificateArray.filter(certificate => {
        return certificate.expirationDate > threshold_datetime; // has enough date
    });
    // console.log("certificate_array_info");
    // console.log(certificate_array_info);

    certificate_array_warn = kvCertificateArray.filter(certificate => {
        return certificate.expirationDate > current_datetime && certificate.expirationDate < threshold_datetime;
    });
    // console.log("certificate_array_warn");
    // console.log(certificate_array_warn);

    certificate_array_expire = kvCertificateArray.filter(certificate => {
        return certificate.expirationDate < current_datetime;
    });
    // console.log("certificate_array_expire");
    // console.log(certificate_array_expire);


    htmlMessage = "<h1>KeyVault Expiration Date checker</h1>";
    htmlMessage = htmlMessage.concat("KeyVault: "+ keyVaultName +", "+url+"\n");
    htmlMessage = htmlMessage.concat("Check date: "+ new Date(current_datetime).toISOString() +"\n");
    
    // build output for secret
    htmlMessage = htmlMessage.concat("<h2>Secrets records</h2>\n");
    htmlMessage = htmlMessage.concat("<h3>Warning - Renewal date nears.</h3>\n");
    htmlMessage = htmlMessage.concat( createHtmlTable(secret_array_warn, "secret") );
    htmlMessage = htmlMessage.concat("\n");
    htmlMessage = htmlMessage.concat("<h3>Already Expired</h3>\n");
    htmlMessage = htmlMessage.concat( createHtmlTable(secret_array_expire, "secret") );
    htmlMessage = htmlMessage.concat("\n");
    htmlMessage = htmlMessage.concat("<h3>No work</h3>\n");
    htmlMessage = htmlMessage.concat( createHtmlTable(secret_array_info, "secret") );
    htmlMessage = htmlMessage.concat("\n");

    
    // build output for certificate
    htmlMessage = htmlMessage.concat("<h2>Certificates records</h2>\n")
    htmlMessage = htmlMessage.concat("<h3>Warning - Renewal deadline nears.</h3>\n");
    htmlMessage = htmlMessage.concat( createHtmlTable(certificate_array_warn, "certificate") );
    htmlMessage = htmlMessage.concat("\n");
    htmlMessage = htmlMessage.concat("<h3>Already Expired</h3>\n");
    htmlMessage = htmlMessage.concat( createHtmlTable(certificate_array_expire, "certificate") );
    htmlMessage = htmlMessage.concat("\n");
    htmlMessage = htmlMessage.concat("<h3>No work</h3>\n");
    htmlMessage = htmlMessage.concat( createHtmlTable(certificate_array_info, "certificate") );
    htmlMessage = htmlMessage.concat("\n");

    // output: sendgrid
    // create email address config
    email_to_list = process.env["SendGrid_email_to"].split(",");
    email_from = { "email": process.env["SendGrid_email_from"] };

    email_to = []
    for (let i = 0; i < email_to_list.length; i++) {
        email_to_item = { "to": [ { "email": email_to_list[i] } ] };
        email_to.push(email_to_item);
    }
    
    // sendgrid mail payload
    var message = {
        "personalizations": "",
        from: "",
        subject: "",
        content: [{
            type: 'text/plain',
            value: ""
        }]
    };

    message.personalizations = email_to;
    message.from = email_from;
    message.subject = "Azure KeyVault notification: "+ new Date(current_datetime).toISOString();
    message.content[0].type = "text/html"
    message.content[0].value = htmlMessage;

    // send with sendgrid
    return message;
};

function createHtmlTable(dataArray, type) {
    tmpContents = "";
    tmpContents = tmpContents.concat("<table>\n");
    // label
    tmpContents = tmpContents.concat("  <tr>\n");
    tmpContents = tmpContents.concat("    <td>name</td>\n");
    tmpContents = tmpContents.concat("    <td>expiration date</td>\n");
    if (type == 'secret') {
        tmpContents = tmpContents.concat("    <td>resource id</td>\n");
    }else if (type == 'certificate') {
        tmpContents = tmpContents.concat("    <td>subject</td>\n");
    }
    tmpContents = tmpContents.concat("  </tr>\n");

    // elem
    for (elem of dataArray) {
        tmpContents = tmpContents.concat("  <tr>\n");
        tmpContents = tmpContents.concat("    <td>"+elem.name+"</td>\n");
        tmpContents = tmpContents.concat("    <td>"+new Date(elem.expirationDate).toISOString()+"</td>\n");
        if (type == 'secret') {
            tmpContents = tmpContents.concat("    <td>"+elem.certificateResourceId+"</td>\n");
        }else if (type == 'certificate') {
            tmpContents = tmpContents.concat("    <td>"+elem.subject+"</td>\n");
        }
        tmpContents = tmpContents.concat("  </tr>\n");
    }
    tmpContents = tmpContents.concat("</table>");

    return tmpContents;
}


class Secret {
    constructor(name, expirationDate, certificateResourceId) {
        this.name = name;
        this.expirationDate = expirationDate;
        this.certificateResourceId = certificateResourceId; // Azure Resource ID: /subscriptions/.../resourceGroups/.../providers/Microsoft.CertificateRegistration/certificateOrders/...
    }
}

class Certificate {
    constructor(name, expirationDate, subject) {
      this.name = name;
      this.expirationDate = expirationDate;
      this.subject = subject; // CN=example.com
    }
}
  