declare module "smtp-tester" {
  import type { Attachment, HeaderValue, ParsedMail } from "mailparser"
  import type { SMTPServer } from "smtp-server"

  /**
   * Initializes the SMTP test server.
   *
   * @param port The port number to listen on.
   */
  function init(port: number): MailServer

  /**
   * A handler that triggers when an email is received by a specific recipient.
   *
   * @param recipient The email address of the recipient.
   * @param id The internal ID of the email.
   * @param email The email being received.
   */
  type Handler = (recipient: string, id: number, email: EmailInfo) => void

  /**
   * A catch-all handler that triggers when any email is received.
   *
   * @param recipient Always `null`.
   * @param id The internal ID of the email.
   * @param email The email being received.
   */
  type CatchAllHandler = (recipient: null, id: number, email: EmailInfo) => void

  /**
   * The object returned by captureOne().
   *
   * @param recipient The email address of the recipient.
   * @param id The internal ID of the email.
   * @param email The email being received.
   */
  interface CaptureOneResult {
    address: string
    id: number
    email: EmailInfo
  }

  /**
   * The SMTP test server.
   */
  export interface MailServer {
    /**
     * An SMTP server instance.
     */
    smtpServer: SMTPServer

    /**
     * Binds a handler that fires whenever a specific recipient receives an email.
     *
     * @param recipient The recipient to bind to.
     * @param handler The handler function.
     */
    bind(recipient: string, handler: Handler): void

    /**
     * Binds a handler that fires whenever any recipient receives an email.
     *
     * @param handler The catch-all handler function.
     */
    bind(handler: CatchAllHandler): void

    /**
     * Unbinds a handler from a specific recipient.
     *
     * @param recipient The recipient to bind to.
     * @param handler The handler function.
     */
    unbind(recipient: string, handler: Handler): void

    /**
     * Unbinds a handler from all recipients.
     *
     * @param handler The catch-all handler function.
     */
    unbind(handler: CatchAllHandler): void

    /**
     * Returns a promise that resolves when the recipient receives an email. Will reject after the specified wait time if no email is captured.
     *
     * @param recipient The recipient to bind to.
     * @param options The options object.
     * @param options.wait The maximum time in milliseconds to wait before rejecting. Use `0` to wait forever (default).
     */
    captureOne(
      recipient: string,
      options: { wait: number }
    ): Promise<CaptureOneResult>

    /**
     * Removes a message from the mail server.
     *
     * @param messageID The ID of the message to remove.
     */
    remove(messageID: number): void

    /**
     * Removes all message from the mail server.
     */
    removeAll(): void

    /**
     * Stops the SMTP server.
     *
     * @param callback The callback that is fired when the server is closed.
     */
    stop(callback: () => void): void

    /**
     * Loads a pre-shipped module.
     *
     * @param name The name of the module to load. Currently, only `"logAll"` is available.
     */
    module(name: "logAll"): true

    /**
     * Unloads a module.
     *
     * @param name The name of the module to unload. Currently, only `"logAll"` is available.
     */
    unmodule(name: "logAll"): void
  }

  /**
   * Contains information about a received email.
   */
  interface EmailInfo {
    /**
     * The sender of the email.
     */
    sender: string

    /**
     * The receivers of the email.
     */
    receivers: Record<string, true>

    /**
     * The raw data of the email.
     */
    data: string

    /**
     * The headers of the email.
     */
    headers: Record<string, HeaderValue>

    /**
     * The html body of the email.
     */
    html: ParsedMail["html"]

    /**
     * The text body of the email.
     */
    body: ParsedMail["text"]

    /**
     * The attachments of the email.
     */
    attachments: Attachment[]
  }
}
