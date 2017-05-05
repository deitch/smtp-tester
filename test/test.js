const Nodemailer = require('nodemailer');
const SMTPTester = require('../lib/index');
const test       = require('tape-promise').default(require('tape'));


let smtpTester;
let smtpTransport;


const sender = 'smtpmailtest@gmail.com';


function sendmail(to, subject, body, headers) {
  return smtpTransport.sendMail({
    from:    sender,
    to,
    subject,
    text:    body,
    headers
  });
}


test('setup', function(t) {
  const port = 4025;
  smtpTransport = Nodemailer.createTransport({ port });
  smtpTester    = SMTPTester.init(port);
  t.end();
});


test('specific handler', function(t) {
  const recipient = 'foo@gmail.com';
  const subject   = 'email test';
  const body      = 'This is a test email';

  function handler(address, id, email) {
    t.equal(address,            recipient);
    t.equal(email.headers.to,   recipient);
    t.equal(email.headers.from, sender);
    t.equal(email.body,         body);

    smtpTester.unbind(recipient, handler);
    smtpTester.removeAll();

    t.end();
  }

  smtpTester.bind(recipient, handler);
  sendmail(recipient, subject, body).catch(t.error);
});


test('handler with two emails', function(t) {
  const recipient = 'foo@gmail.com';
  const subject   = 'email test';
  const body      = 'This is a test email';
  const emails    = [];

  function handler(address, id, email) {
    // Save the email
    emails.push({ address: address, id: id, email: email });
  }

  smtpTester.bind(recipient, handler);

  // Send the email twice, each time with a different subject and body
  return Promise.resolve()
    .then(() => sendmail(recipient, `${subject}0`, `${body}0`))
    .then(() => sendmail(recipient, `${subject}1`, `${body}1`))
    .then(function() {
      // process the emails
      t.equal(emails.length, 2);

      t.equal(emails[0].address,               recipient);
      t.equal(emails[0].email.headers.to,      recipient);
      t.equal(emails[0].email.headers.from,    sender);
      t.equal(emails[0].email.headers.subject, `${subject}0`);
      t.equal(emails[0].email.body,            `${body}0`);

      t.equal(emails[1].address,               recipient);
      t.equal(emails[1].email.headers.to,      recipient);
      t.equal(emails[1].email.headers.from,    sender);
      t.equal(emails[1].email.headers.subject, `${subject}1`);
      t.equal(emails[1].email.body,            `${body}1`);

      smtpTester.unbind(recipient, handler);
    });
});


test('two emails with different handlers', function(t) {
  const recipient = 'foo@gmail.com';
  const subject   = 'email test';
  const body      = 'This is a test email';

  function handler0(address, id, email) {
    t.equal(address,               recipient);
    t.equal(email.headers.to,      recipient);
    t.equal(email.headers.from,    sender);
    t.equal(email.headers.subject, `${subject}0`);
    t.equal(email.body,            `${body}0`);
    smtpTester.unbind(recipient, handler0);
    smtpTester.removeAll();
  }

  function handler1(address, id, email) {
    t.equal(address,               recipient);
    t.equal(email.headers.to,      recipient);
    t.equal(email.headers.from,    sender);
    t.equal(email.headers.subject, `${subject}1`);
    t.equal(email.body,            `${body}1`);
    smtpTester.unbind(recipient, handler1);
    smtpTester.removeAll();
  }

  // Send the email twice, each time with a different subject and body,
  // also different handlers each time.
  return Promise.resolve()
    .then(() => sendmail(recipient, `${subject}0`, `${body}0`))
    .then(() => smtpTester.bind(recipient, handler0))
    .then(() => sendmail(recipient, `${subject}1`, `${body}1`))
    .then(() => smtpTester.bind(recipient, handler1));
});



test('catch-all handler', function(t) {
  const recipient = 'bar@gmail.com';
  const subject   = 'some other test';
  const body      = 'This is another test email';

  function handler(address, id, email) {
    t.equal(address,            null);
    t.equal(email.headers.to,   recipient);
    t.equal(email.headers.from, sender);
    t.equal(email.body,         body);
    smtpTester.unbind(handler);
    smtpTester.removeAll();
    t.end();
  }

  smtpTester.bind(handler);

  sendmail(recipient, subject, body).catch(t.error);
});


test('folded headers', function(t) {
  const longHeaderValue = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aliquam sagittis purus vitae aliquet euismod.';
  const recipient       = 'bar@gmail.com';
  const subject         = 'email test why not';
  const body            = 'Why not a test email?';

  function handler(address, id, email) {
    t.equal(email.headers.to,          recipient);
    t.equal(email.headers.from,        sender);
    t.equal(email.headers['x-folded'], longHeaderValue);
    smtpTester.unbind(handler);
    smtpTester.removeAll();
    t.end();
  }

  smtpTester.bind(handler);

  const headers = {
    'x-folded': longHeaderValue
  };

  sendmail(recipient, subject, body, headers).catch(t.error);
});


test('remove by ID', function(t) {
  const recipient = 'foo@gmail.com';
  const subject   = 'email strange test';
  const body      = 'Charmed test email';

  let timeout;

  function handler1(address, id) {
    smtpTester.remove(id);
    smtpTester.unbind(handler1);

    timeout = setTimeout(function() {
      smtpTester.unbind(handler2);
      t.end();
    }, 500);

    smtpTester.bind(handler2);
  }

  function handler2() {
    clearTimeout(timeout);
    t.fail('Did not expect to get any other message.');
    smtpTester.unbind(handler2);
    t.end();
  }

  smtpTester.bind(handler1);

  sendmail(recipient, subject, body).catch(t.error);
});


test('unescape double dots', function(t) {
  const recipient = 'foo@gmail.com';
  const subject   = 'email test';
  const body      = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aliquam sagittis... Purus vitae aliquet euismod.';

  function handler(address, id, email) {
    t.equal(email.body, body);
    smtpTester.unbind(recipient, handler);
    smtpTester.removeAll();
    t.end();
  }

  smtpTester.bind(recipient, handler);

  sendmail(recipient, subject, body).catch(t.error);
});


test('unbind', function(t) {
  const recipient = 'foo@gmail.com';
  const subject   = 'email strange test';
  const body      = 'Charmed test email';

  let handler1Called = false;

  function handler1() {
    handler1Called = true;
  }

  function handler2() {
    t.fail('handler2 was unbound and should not be called.');
  }

  smtpTester.bind(handler1);
  smtpTester.bind(handler2);

  smtpTester.unbind(handler2);

  sendmail(recipient, subject, body)
    .then(function() {
      t.ok(handler1Called);
      t.end();
    })
    .catch(t.error);
});


test('modules', function(t) {
  /* eslint-disable no-console */
  const recipient = 'foo@gmail.com';
  const subject   = 'email test modules';
  const body      = 'This is a module test email';

  const moduleLoaded = smtpTester.module('logAll');
  t.equal(moduleLoaded, true);

  const _log    = console.log;
  console.log   = function(msg) {
    console.log = _log;

    const lines = msg
      .split('\n')
      .filter(line => line.indexOf('Date:') === -1);

    t.same(lines, [
      `From: ${sender}`,
      `To: ${recipient}`,
      `Subject: ${subject}`,
      body,
      '',
      ''
    ]);

    t.end();
  };

  sendmail(recipient, subject, body).catch(t.error);
  /* eslint-enable no-console */
});


test('captureOne', function(t) {
  const recipient = 'foo@gmail.com';
  const subject   = 'email test';
  const body      = 'This is a test email';

  smtpTester.removeAll();

  return sendmail(recipient, subject, body)
    .then(() => smtpTester.captureOne(recipient))
    .then(function({ id, email }) {
      t.ok(id);
      t.equal(email.body, body);
    });
});


test('captureOne with wait', function(t) {
  smtpTester.removeAll();

  return smtpTester.captureOne('foo@gmail.com', { wait: 100 })
    .then(function() {
      t.fail('Expected promise to be rejected');
    })
    .catch(function(error) {
      t.equal(error.message, 'No message delivered to foo@gmail.com');
    });
});


test('html', function(t) {
  smtpTester.removeAll();

  const recipient = 'foo@gmail.com';
  const subject   = 'email test';
  const html      = '<h1>This is a test email</h1>';

  function handler(address, id, email) {
    t.equal(address,    recipient);
    t.equal(email.html, html);

    smtpTester.unbind(recipient, handler);

    t.end();
  }

  smtpTester.bind(recipient, handler);

  smtpTransport.sendMail({
    from:    sender,
    to:      recipient,
    subject,
    html
  }).catch(t.error);
});


test('teardown', function(t) {
  smtpTester.stop();
  smtpTransport.close();
  t.end();
});
