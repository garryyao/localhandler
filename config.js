module.exports = {
	protocol: 'http', // sub-domain (env) is determinate by the proxy domain in runtime, e.g. uat.englishtown.local => uat.englishtown.com
	host: 'englishtown.com', // C parameters as query string
	search: 'c=countrycode=us|culturecode=en|partnercode=None|languagecode=en|studentcountrycode=us', // queryproxy endpoint
	pathname: '/services/shared/queryproxy'
};
