var mailer   = require('nodemailer');
var ms       = require('../lib/index');
var test     = require('tape');
var os       = require('os');


var PORT = 4025;
var mailServer;
var smtpTransport;
var sender = 'smtpmailtest@gmail.com';


function sendmail(to, subject, body, headers, cb) {
  if (!cb && typeof(headers) === 'function') {
    cb = headers;
    headers = {};
  }
  smtpTransport.sendMail({
    sender:  sender,
    to:      to,
    subject: subject,
    body:    body,
    headers: headers
  }, cb);
}

test('setup', function(t) {
  smtpTransport = mailer.createTransport('SMTP',{
    host: 'localhost',
    port: PORT,
    name: os.hostname()
  });
  mailServer = ms.init(PORT);
  t.end();
});


test('specific handler', function(t) {
  var recp = 'foo@gmail.com', subject = 'email test', body = 'This is a test email',
  handler = function(address, id, email) {
    t.equal(address,            recp);
    t.equal(email.headers.To,   recp);
    t.equal(email.headers.From, sender);
    t.equal(email.body,         body);
    mailServer.unbind(handler);
    mailServer.removeAll();
    t.end();
  };

  mailServer.bind('foo@gmail.com', handler);

  sendmail(recp, subject, body, function(err, response) {
    t.error(err);
  });
});


test('catch-all handler', function(t) {
  var recp = 'bar@gmail.com', subject = 'email test', body = 'This is a test email',
  handler = function(address, id, email) {
    t.equal(address,            null);
    t.equal(email.headers.To,   recp);
    t.equal(email.headers.From,  sender);
    t.equal(email.body,         body);
    mailServer.unbind(handler);
    mailServer.removeAll();
    t.end();
  };

  mailServer.bind(handler);

  sendmail(recp, subject, body, function(err, response) {
    t.error(err);
  });
});


test('folded headers', function(t) {
  var recp = 'bar@gmail.com', subject = 'email test', body = 'This is a test email',
  xfolded = 'This is a\r\n folded header', xfoldedtab = 'This is a\r\n\t tab folded header',
  handler = function(address, id, email) {
    t.equal(email.headers.To,         recp);
    t.equal(email.headers.From,       sender);
    t.equal(email.headers.Xfolded,    xfolded.replace(/[\r\n\t]/g,''));
    t.equal(email.headers.Xfoldedtab, xfoldedtab.replace(/[\r\n\t]/g,''));
    mailServer.unbind(handler);
    mailServer.removeAll();
    t.end();
  };

  mailServer.bind(handler);

  var headers = {
    xfolded:    xfolded,
    xfoldedtab: xfoldedtab
  };

  sendmail(recp, subject, body, headers, function(err, response) {
    t.error(err);
  });
});


test('remove by ID', function(t) {
  var recp = 'foo@gmail.com', subject = 'email test', body = 'This is a test email',
  handler1 = function(address, id, email) {
    mailServer.remove(id);
    mailServer.unbind(handler1);

    var timeout = setTimeout(function() {
      mailServer.unbind(handler2);
      t.end();
    }, 500);

    var handler2 = function(address, id, email) {
      clearTimeout(timeout);
      t.fail('Did not expect to get any other message.');
      mailServer.unbind(handler2);
      t.end();
    };

    mailServer.bind(handler2);
  };

  mailServer.bind(handler1);

  sendmail(recp, subject, body, function(err, response) {
    t.error(err);
  });
});


test('modules', function(t) {
  var recp = 'foo@gmail.com', subject = 'email test', body = 'This is a test email',
  success = mailServer.module('logAll');
  t.equal(success, true);

  var _log    = console.log;
  console.log = function(msg) {
    console.log = _log;

    var lines = msg
      .split('\n')
      .filter(function(line) {
        return line.indexOf('Date:') === -1;
      });

    t.same(lines, [
      'From: '+sender,
      'To: '+recp,
      'Subject: '+subject,
      body,
      '',
      ''
    ]);

    t.end();
  };

  sendmail(recp, subject, body, function(err, response) {
    t.error(err);
  });
});


test('teardown', function(t) {
  mailServer.stop();
  smtpTransport.close();
  t.end();
});
