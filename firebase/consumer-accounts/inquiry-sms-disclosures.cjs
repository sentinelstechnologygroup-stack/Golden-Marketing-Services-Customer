const disclosures = Object.freeze({
 'north-houston-sms-v3': 'I agree to receive automated inquiry-confirmation and customer-care texts from Golden Cross Realty and its office support team about my real estate inquiry. Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for help. SMS consent is optional and is not a condition of purchase. Mobile information and SMS consent will not be shared with third parties for promotional or marketing purposes.',
 'north-houston-sms-v4': 'I agree to receive SMS, emails, or phone calls from Golden Cross Realty and its office support team about my real estate inquiry.',
});
const validVersion = version => Object.hasOwn(disclosures, version);
const validDisclosure = consent => validVersion(consent?.smsVersion) && consent.smsText === disclosures[consent.smsVersion];
module.exports = { validVersion, validDisclosure };
