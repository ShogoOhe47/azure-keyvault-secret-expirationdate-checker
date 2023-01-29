# Azure Key Vault Expiration Date Checker
This repository contains [Azure Functions](https://learn.microsoft.com/en-us/azure/azure-functions/) code that validation expiration date of secret and certificate on [Azure Key Vault](https://learn.microsoft.com/en-us/azure/key-vault/).


The original code was a validate and notification expiration date for App Service Certificates stored as secrets in Azure Key Vault.
New code extend function, validate secrets and certificate, and notificate if it was close to expire.


# Mecanism
Bellow diagram show us this code mechanism.

![diagram](./image/diagram.jpg)

1. Validate Secrets and Certificate expiration date stored in KeyVault by Functions [Timer Trigger](https://learn.microsoft.com/en-us/azure/azure-functions/functions-bindings-timer?tabs=in-process&pivots=programming-language-javascript).
2. Send Expiration date with Functions [Sendgrid output binding](https://learn.microsoft.com/en-us/azure/azure-functions/functions-bindings-sendgrid?tabs=in-process%2Cfunctionsv2&pivots=programming-language-javascript).
3. Notifify by e-mail.


# How to use
This sample code tested with Azure Functions runtime version 4.x (4.14.0.19631), Node.js v16LTS (v16.16.0) and Windows consumption plan.

if you want to run code, add Application Settings and publish by ```func azure functionapp publish <FunctionAppName>``` commands.


## prepare of Sendgrid
Sendgrid has some limited but free plan. Prepare a free or paid plan according to the following document.

- [Sending Email with Microsoft Azure](https://docs.sendgrid.com/for-developers/partners/microsoft-azure-2021)


API key showed only once on create, please records on notepad. For Restricted Access, 'Mail Send' is sufficient.


## Application Settings
Set Application Settings is required to specify the Azure Key Vault to be check, and send e-mail by Sendgrid.
| Name | Value | means |
| ---- | -- | ---- |
| KEYVAULT_NAME | Name of Azure Key Vault | Name of Azure Key Vault |
| AzureWebJobsSendGridApiKey | SendGrid API Key | [AzureWebJobsSendGridApiKey is default value](https://learn.microsoft.com/en-us/azure/azure-functions/functions-bindings-sendgrid?tabs=in-process%2Cfunctionsv2&pivots=programming-language-javascript#configuration) |
| SendGrid_email_to | e-mail address | Email to. if you separated with ','(comma), it is able to specify multiple e-mail address. |
| SendGrid_email_from | e-mail address | Email from. Confirmed email address for Sender Authentication by Sendgrid. |
| EXPIRATION_THRESHOLD_INDAYS | a number of days. | Number of days subject to expiration date warning |


if you want to set with Azure CLI ([az functionapp config appsettings set](https://learn.microsoft.com/en-us/cli/azure/functionapp/config/appsettings?view=azure-cli-latest#az-functionapp-config-appsettings-set)), you able to following commands。
```
$FunctionappName = "resource name of Functions"
$ResourceGroupName = "resource group name"
az functionapp config appsettings set --name $FunctionappName --resource-group $ResourceGroupName  --settings "KEYVAULT_NAME=resource name of Azure Key Vault"
az functionapp config appsettings set --name $FunctionappName --resource-group $ResourceGroupName  --settings "AzureWebJobsSendGridApiKey=SG.APIkey"
az functionapp config appsettings set --name $FunctionappName --resource-group $ResourceGroupName  --settings "SendGrid_email_to=foo@gmail.com, bar@outlook.com"
az functionapp config appsettings set --name $FunctionappName --resource-group $ResourceGroupName  --settings "SendGrid_email_from=example@outlook.com"
az functionapp config appsettings set --name $FunctionappName --resource-group $ResourceGroupName  --settings "EXPIRATION_THRESHOLD_INDAYS=45"
```

## Enable managed ID
Authentication is required to access Azure Key Vault from Azure Functions.
Using Managed ID in this scenario.


The configuration step is as follows:
1. [enable a system-assigned identity](https://learn.microsoft.com/en-us/azure/app-service/overview-managed-identity?tabs=portal%2Chttp) in Azure Functions.
2. [Granting access rights from Functions in the access policy](https://learn.microsoft.com/en-us/azure/active-directory/managed-identities-azure-resources/tutorial-windows-vm-access-nonaad#grant-access) in Azure Key Vault.


The permissions required by the Key Vault [Access Plicy] are List and Get Secrets and List and Get Certificates.


# Execution sample
If it works correctly, you will be notified by e-mail as follows.

![mail sample](./image/mailsample.jpg)

Contents of Secret and Contents of Certificate are reported as "Secrets records", "Certificates records".
Items that are close to expiration (will expire within the number of days specified in EXPIRATION_THRESHOLD_INDAYS) will be displayed as "Warning - Renewal date nears.".
The expired items are displayed as "Already Expired" and Items with sufficient time remaining to expire are displayed as "No work."

If Secrets is related with App Service Certificate, display Resource ID of App Service Certificate (it was start with "/subscriptions/...").
If item is Certificate, the issuer (CN:CommonName) included in the certificate is also listed.
