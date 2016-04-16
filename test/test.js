var mailer   = require('nodemailer');
var ms       = require('../lib/index');
var test     = require('tape');
var os       = require('os');


var PORT = 4025;
var mailServer;
var smtpTransport;


function sendmail(to, subject, body, headers, cb) {
  if (!cb && typeof(headers) === 'function') {
    cb = headers;
    headers = {};
  }
  smtpTransport.sendMail({
    sender:  'smtpmailtest@gmail.com',
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
  var handler = function(address, id, email) {
    t.equal(address,            'foo@gmail.com');
    t.equal(email.headers.To,   'foo@gmail.com');
    t.equal(email.headers.From, 'smtpmailtest@gmail.com');
    t.equal(email.body,         'This is a test email');
    mailServer.unbind(handler);
    mailServer.removeAll();
    t.end();
  };

  mailServer.bind('foo@gmail.com', handler);

  sendmail('foo@gmail.com', 'email test', 'This is a test email', function(err, response) {
    t.error(err);
  });
});


test('catch-all handler', function(t) {
  var handler = function(address, id, email) {
    t.equal(address,            null);
    t.equal(email.headers.To,   'bar@gmail.com');
    t.equal(email.headers.From, 'smtpmailtest@gmail.com');
    t.equal(email.body,         'This is a test email');
    mailServer.unbind(handler);
    mailServer.removeAll();
    t.end();
  };

  mailServer.bind(handler);

  sendmail('bar@gmail.com', 'email test', 'This is a test email', function(err, response) {
    t.error(err);
  });
});


test('folded headers', function(t) {
  var handler = function(address, id, email) {
    t.equal(email.headers.To,         'bar@gmail.com');
    t.equal(email.headers.From,       'smtpmailtest@gmail.com');
    t.equal(email.headers.Xfolded,    'This is a folded header');
    t.equal(email.headers.Xfoldedtab, 'This is a tab folded header');
    mailServer.unbind(handler);
    mailServer.removeAll();
    t.end();
  };

  mailServer.bind(handler);

  var headers = {
    xfolded:    'This is a\r\n folded header',
    xfoldedtab: 'This is a\r\n\t tab folded header'
  };

  sendmail('bar@gmail.com', 'email test', 'This is a test email', headers, function(err, response) {
    t.error(err);
  });
});


test('remove by ID', function(t) {
  var handler1 = function(address, id, email) {
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

  sendmail('foo@gmail.com', 'email test', 'This is a test email', function(err, response) {
    t.error(err);
  });
});


test('modules', function(t) {
  var success = mailServer.module('logAll');
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
      'From: smtpmailtest@gmail.com',
      'To: foo@gmail.com',
      'Subject: email test',
      'This is a test email',
      '',
      ''
    ]);

    t.end();
  };

  sendmail('foo@gmail.com', 'email test', 'This is a test email', function(err, response) {
    t.error(err);
  });
});


test('teardown', function(t) {
  mailServer.stop();
  smtpTransport.close();
  t.end();
});
