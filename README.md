smtp-tester 
===========

![](https://travis-ci.org/deitch/smtp-tester.svg?branch=master)

Overview
--------
smtp-tester is a simple smtp server that accepts connections, receives mail, and then calls callbacks that are bound to a particular address.

Installation
------------
Installation is fairly straightforward, just install the npm module:

    npm install smtp-tester

Starting an SMTP server
-----------------------
First, require smtp-tester:

````JavaScript
var ms = require('smtp-tester');
````

Next, initialize a server with a port it should listen on (yes, I know, never end a sentence in a preposition).

````JavaScript
var mailServer = ms.init(port);
````

Done. Your SMTP server is now listening on port 'port'.

Sending Mail
------------
Send mail using any SMTP client you want. For node work, I personally use nodemailer 

    npm install nodemailer

Receiving Mail
--------------
To receive mail, bind a handler to the mailServer you created earlier.

````JavaScript
var ms, mailServer, handler, port = 4000;
ms = require('smtp-tester');
mailServer = ms.init(port);
handler = function(addr,id,email) {
	// do something interesting
};

mailServer.bind("foo@bar.com",handler);
````

Done. Every mail sent to foo@bar.com (and every one sent before binding) will call the handler exactly once.

You can have as many handlers as you want, they are all executed, even for the same address. However, execution order, while usually in the order in which they were added, is not guaranteed.

# Catch-All Handlers
If you want a handler to catch every email that is sent through the system, just bind with no address at all.

````JavaScript
handler = function(addr,id,email) {
	// do something interesting
	// because this is a catch-all, the addr will be null
};
mailServer.bind(handler);
````

Catch-All handlers are *always* run before specific handlers.


Stopping Receipt
----------------
To stop receiving mail at a particular handler, just unbind.

````JavaScript
mailServer.unbind("foo@bar.com",handler);
````

# Catch-All Handlers
If you want to remove a catch-all handler that catches every email that is sent through the system, just unbind with no address at all.

````JavaScript
handler = function(addr,id,email) {
	// do something interesting
	// because this is a catch-all, the addr will be null
};
mailServer.bind(handler); // this adds it
mailServer.unbind(handler); // this removes it
````

Removing Messages
-----------------
To remove messages from the mail server, you can remove an individual message or all of them:

````JavaScript
mailServer.remove(id);
mailServer.removeAll();
````

Stopping the Server
-------------------
Surprisingly, the method is just called "stop".

````JavaScript
mailServer.stop();
````

Handlers
--------
Handlers that receive mail are passed three parameters.

* addr: Address to which the email was addressed, and for which the handler was bound. If this is a catch-all handler, then this is null.
* id: Internal ID of the email in this mail server process. Useful for removing messages or checking against something in our cache.
* email: JavaScript object of the email, containing "sender", "receivers", "data" (raw text), "headers" and "body".

Sample email object is as follows, taken from the test.js included with the package.

````JavaScript
{ sender: { address: '<mailtest@bar.com>', valid: true },
  receivers: { 'foo@bar.com': true },
  data: 'X-Mailer: Nodemailer (0.2.3; +http://www.nodemailer.org)\r\nDate: Thu, 01 Dec 2011 10:24:01 GMT\r\nFrom: mailtest@bar.com\r\nTo: foo@bar.com\r\nSubject: email test\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\nThis is a test mail\r\n',
  headers: 
   { 'X-Mailer': 'Nodemailer (0.2.3; +http://www.nodemailer.org)',
     Date: 'Thu, 01 Dec 2011 10:24:01 GMT',
     From: 'mailtest@bar.com',
     To: 'foo@bar.com',
     Subject: 'email test',
     'MIME-Version': '1.0',
     'Content-Type': 'text/plain; charset=UTF-8',
     'Content-Transfer-Encoding': 'quoted-printable' },
  body: 'This is a test mail\r\n' }
````

Modules
-------
smtp-tester supports pre-shipped modules. They are named and can be run by calling

````JavaScript
var success;
// to load a module
success = mailServer.module(name);

// to unload a module
mailServer.unmodule(name);
````

If the module successfully loads, it will return success, else it will return false.

The following modules are currently available.

* logAll: logs every message received to the console in a text format close to raw text.

More are expected to follow.


Testing
-------
Just run

    npm test

Note that each build triggers a Travis CI build


