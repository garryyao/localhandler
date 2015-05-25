# local handler

A HTTP server that interprets Englishtown handler syntax of blurbs, CCLs, medias and CMSs used in **HTML files**, it is primarily targeted 
to be used in conjunction with a **reverse proxy** that serve local files in front-end dev environment, enabling you to preview changes and make local debugging a lot easier, check the below [Configure Reverse Proxy](#Configure-Reverse-Proxy) configurations section to understand how it works.

## Installation
```bash
npm i -g localhandler
```

## Command Line Options 

### '-b, --basepath' : http handler base path

This option set the root path of the web application, so local files are resolved relative to this base path. Use this option to make the local handler URL matches with the virtual path configuration of your HTTP server.

### '-c, --umbraco' : local CMS contents directory

This option specifies the path of an local [Umbraco](http://umbraco.englishtown.com/) repository where each file name represents a CMS key, so when an Umbraco key is queried in the HTML (by getContent:the_cms_key) file content of the local file with `the_cms_key` is used without actually querying for Umbraco. Check [umbra](https://github.com/garryyao/umbra) for more details to understand the Umbraco repository concept.

### '-p, --processor' : module that exported a custom content processor function  

This option specified a pre-processor function that resolves local file content as the head of the
processing pipeline, basically transform the file contents that are supposed to be consumed by the next processor, e.g. 

```!js
module.exports = function preProcess(html) {
  // reinforce "dev" environment, and use local static file instead of the CDN version
  return html.replace(new RegExp('{CCL:myapp.ui.env}', 'gi'), 'dev')
    .replace(new RegExp('{CCL:configuration.servers.cache}/_shared/myapp/{CCL:myapp.ui.version}/?', 'gi'), '');
};
```


## Configure Reverse Proxy 

Depending on your HTTP Reverse Proxy of choice, the configuration would vary while here we exemplify the 
Apache [mod_proxy](http://httpd.apache.org/docs/2.2/mod/mod_proxy.html#proxypass) configurations 
that are required to integrate the localhandler server to setup a sample Englishtown UAT dev environment.

```
# Sample Reverse Proxy for the UAT server environment
<VirtualHost *:80>
    DocumentRoot /Users/garry/Stash/labs-school/school-ui
    ServerName schooluat.dev
    ServerAlias schooluat.englishtown.local
    # This delegate all requests for HTML files to the localhandler server
    ProxyPassMatch ^/(.*\.html)$ http://localhost:3000/$1
    ProxyPass / http://schooluat.englishtown.com/
    ProxyPassReverse / http://schooluat.englishtown.com/
    ProxyPassReverseCookieDomain schooluat.englishtown.com schooluat.dev
    ProxyPassReverseCookieDomain schooluat.englishtown.com schooluat.englishtown.local
</VirtualHost> 
```