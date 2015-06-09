# local handler

A HTTP server that interprets Englishtown handler syntax of blurbs, CCLs, medias and CMSs used in **HTML files**, it is primarily targeted 
to be used in conjunction with a **reverse proxy** that serve local files in front-end dev environment, enabling you to preview changes and make local debugging a lot easier, check the below [Configure Reverse Proxy](#integrate-with-other-reverse-proxies) configurations section to understand how it works.

## Installation
```bash
npm i -g localhandler
```
## Basic Usage

Start the localhandler as a local HTTP server in your application working copy:

```bash
> cd your-app
> localhandler -b school/e12
localhandler is running on port:3000
```

## Command Line Options 

### '-b, --basepath' : the base URL on which your application is mounted

This option set the root path of the web application, so local files are resolved relative to this base path. Use this option to make the local handler URL matches with the virtual path configuration of your HTTP server, default to the root path '/'.

### '-f, --processor' : local module implements a custom content processor function  

This option specified a javascript file that export a function, for custom processing as the tip of the HTML processing pipeline, basically transform the file contents that are supposed to be consumed by the next processor, e.g.

```!js
module.exports = function preProcess(html) {
  // reinforce "dev" environment, and use local static file instead of the CDN version
  return html.replace(new RegExp('{CCL:myapp.ui.env}', 'gi'), 'dev')
    .replace(new RegExp('{CCL:configuration.servers.cache}/_shared/myapp/{CCL:myapp.ui.version}/?', 'gi'), '');
};
```

### '-p, --port' : specify your custom port to listen for HTTP request, default to '3000'

This option is just to override the server port to listen for incoming HTTP requests.

## Integrate with other Reverse Proxies

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

```
# Sample Reverse Proxy for the UAT server environment on Nginx
http {
    server {
        listen 80;
        server_name schooluat.dev schooluat.englishtown.local;
        root /Users/garry/Stash/labs-school/school-ui;
        add_header Cache-Control "public, max-age=0";

        proxy_set_header Host $proxy_host;
        proxy_cookie_domain $proxy_host $host;

        location ~* \.html$ {
            proxy_pass http://127.0.0.1:3000;
        }

        location / {
            resolver 10.128.34.91 10.128.34.94;
            proxy_pass http://schooluxuat.englishtown.com;
        }
    }
}
```
