let server;


module.exports = {
  setServer(newServer) {
    server = newServer;
  },
  init() {
    server.bind(logAll);
  }
};


function logAll(recipient, id, email) {
  const lines = [
    `From: ${email.headers.from}`,
    `To: ${email.headers.to}`,
    `Date: ${email.headers.date}`,
    `Subject: ${email.headers.subject}`,
    email.body,
    '',
    ''
  ];

  const string = lines.join('\n');

  console.log(string); // eslint-disable-line no-console
}
