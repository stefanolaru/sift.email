const dns = require("dns"),
    { SMTPClient } = require("smtp-client"),
    disposable = require("disposable-email-domains"),
    free = require("free-email-domains"),
    roles = [
        "abuse",
        "admin",
        "billing",
        "compliance",
        "devnull",
        "dns",
        "ftp",
        "hostmaster",
        "inoc",
        "ispfeedback",
        "ispsupport",
        "list-request",
        "list",
        "maildaemon",
        "noc",
        "no-reply",
        "noreply",
        "null",
        "phish",
        "phishing",
        "postmaster",
        "privacy",
        "registrar",
        "root",
        "security",
        "spam",
        "support",
        "sysadmin",
        "sales",
        "tech",
        "test",
        "undisclosed-recipients",
        "unsubscribe",
        "usenet",
        "uucp",
        "webmaster",
        "www",
    ];

/**
 * Result: VALID / INVALID
 * Accuracy: LOW / MEDIUM / HIGH
 */
const VALID = "VALID",
    INVALID = "INVALID",
    LOW = "LOW",
    MEDIUM = "MEDIUM",
    HIGH = "HIGH";

/**
 * Validates a single email recipient
 * @param {*} input
 * @param {*} timeout
 * @returns resolve object
 */
const validateEmail = async (input, timeout = 5000) =>
    new Promise((resolve) => {
        // verify format
        let result = validateFormat(input),
            response = { result: INVALID, accuracy: HIGH }; // invalid by default

        // format error
        if (result.error) {
            response["reason"] = "Invalid format";
            resolve(response);
        }

        // disposable check
        if (isDisposable(result.domain)) {
            response["reason"] = "Disposable domain";
            resolve(response);
        }

        // role check
        if (isRoleMail(result.domain)) {
            response["reason"] = "Role-based address";
            resolve(response);
        }

        // check domain MX & SMTP
        validateDomain(result.domain, [result.local_part], timeout)
            .then((res) => {
                // resolve final response
                if (res.recipients.invalid.length) {
                    Object.assign(response, {
                        accuracy: res.recipients.invalid[0].accuracy,
                        reason: "Recipient does not exist",
                    });
                } else {
                    response = res.domain; // default to domain result
                }
                // resolve
                resolve(response);
            })
            .catch((err) => {
                console.log(err);

                // resolve whatever
                resolve(response);
            });
    });
/**
 *
 * @param {*} email
 * returns email & email parts
 */
const validateFormat = (email) => {
    //
    const email_regex =
        /^[-!#$%&'*+\/0-9=?A-Z^_a-z`{|}~](\.?[-!#$%&'*+\/0-9=?A-Z^_a-z`{|}~])*@[a-zA-Z0-9](-*\.?[a-zA-Z0-9])*\.[a-zA-Z](-?[a-zA-Z0-9])+$/;

    // check for email
    if (!email) {
        return { error: "Email missing" };
    }

    // trim from spaces
    email = email.trim();

    // check for parts
    const [local_part, domain] = email.split("@");

    // if no localpart, stop
    if (email.indexOf("@") == -1 || !local_part || !local_part.length) {
        return { error: "Invalid format, localpart missing" };
    }
    // if no domain, stop
    if (!domain || !domain.length) {
        return { error: "Invalid format, domain missing" };
    }

    // if localpart exceeds 64
    if (local_part.length > 64) {
        return { error: "Invalid format, local part too long" };
    }

    // if domain exceeds 255
    if (domain.length > 255) {
        return { error: "Invalid format, domain too long" };
    }

    // if domain part exceeds 64
    const domain_parts = domain.split(".");
    if (
        domain_parts.some((part) => {
            return part.length > 64;
        })
    ) {
        return { error: "Invalid format, domain part too long" };
    }

    // check gmail local part requirements
    if (domain == "gmail.com" && local_part.length < 6) {
        return { error: "Does not meet Gmail local part requirements" };
    }

    // test the format with a regex
    if (!email_regex.test(email)) {
        return { error: "Email address has invalid format" };
    }

    return {
        email: email,
        domain: domain,
        local_part: local_part,
    };
};

/**
 *
 * @param {*} domain
 * resolves the MX records & the domain
 */
const mxQuery = async (domain, timeout = 10000) => {
    return new Promise((resolve, reject) => {
        // avoid timeouts
        setTimeout(() => {
            reject("Timeout");
        }, timeout);
        //
        dns.resolveMx(domain, (err, addresses) => {
            // console.log(addresses);
            if (err) {
                reject(err);
            } else {
                // sort by priority
                addresses.sort((a, b) => {
                    return a.priority - b.priority;
                });
                // resolve exchange
                resolve(addresses);
            }
        });
    });
};

/**
 *
 * @param {*} domain
 * checks if the domain is on the disposable domains list
 */
const isDisposable = (domain) => disposable.includes(domain);

/**
 *
 * @param {*} domain
 * checks if the domain is on the free domains list
 */
const isFreeMail = (domain) => free.includes(domain);

/**
 *
 * @param {*} domain
 * checks if the domain is on the roles email list
 */
const isRoleMail = (domain) => roles.includes(domain);

/**
 *
 * @param {*} domain
 * @param {*} recipients
 * @param {*} timeout
 * @returns Object containing domain issue OR invalid recipients / Empty object when no invalid entries were found
 */
const validateDomain = async (domain, recipients, timeout = 5000) => {
    // vars
    let client = null,
        connected = false,
        greylisted = false,
        response = {
            domain: { result: VALID, accuracy: HIGH }, // valid by default
            recipients: { invalid: [] },
        };

    // check domain MX entries
    let mxs = await mxQuery(domain, timeout)
        .then()
        .catch((err) => {
            return [];
        });

    // return error if no MX
    if (!mxs || !mxs.length) {
        // prepare response
        Object.assign(response.domain, {
            result: INVALID,
            reason: "No MX records",
        });
        //
        return Promise.resolve(response);
    }

    // try just the first 2 MX hosts
    mxs = mxs.slice(0, 2);

    // attempt to connect to one of mx hosts
    while (!connected && mxs.length) {
        const mx = mxs.shift();
        // set connection settings
        client = new SMTPClient({ host: mx.exchange, port: 25 });

        // connect to mx
        connected = await client
            .connect({ timeout: timeout })
            .then(() => true)
            .catch((err) => {
                greylisted = isSmtpGreylisted(err);
                return false;
            });
    }

    // stop if still not connected
    if (!connected) {
        // prepare response
        Object.assign(response.domain, {
            accuracy: greylisted ? MEDIUM : LOW,
            reason: "Could not connect to SMTP",
        });
        //
        return Promise.resolve(response);
    }

    // Send a HELO/EHLO command
    greylisted = false;
    const HELO = await client
        .greet({ timeout: timeout })
        .then(() => true)
        .catch((err) => {
            greylisted = isSmtpGreylisted(err);
            return false;
        });

    // stop if HELO doesn't go through
    if (!HELO) {
        try {
            await client.quit({ timeout: timeout });
        } catch (err) {}
        // prepare response
        Object.assign(response.domain, {
            accuracy: greylisted ? MEDIUM : LOW,
            reason: "Could not greet SMTP",
        });
        return Promise.resolve(response);
    }

    // Send a MAIL FROM command
    greylisted = false;
    const MAIL = await client
        .mail({
            from: process.env.EMAIL_FROM_ADDRESS,
            timeout: timeout,
        })
        .then(() => true)
        .catch((err) => {
            greylisted = isSmtpGreylisted(err);
            return false;
        });

    // stop if MAIL doesn't go through
    if (!MAIL) {
        try {
            await client.quit({ timeout: timeout });
        } catch (err) {}
        // prepare response
        Object.assign(response.domain, {
            accuracy: greylisted ? MEDIUM : LOW,
            reason: "Could not communicate with SMTP",
        });
        //
        return Promise.resolve(response);
    }

    // Send a RCPT TO command to a random recipient
    greylisted = false;
    const CATCH_ALL = await client
        .rcpt({
            to: "catch-all-" + Date.now() + "@" + domain,
            timeout: timeout,
        })
        .then(() => true)
        .catch((err) => {
            greylisted = isSmtpGreylisted(err);
            return false;
        });

    // stop if it's a catch all domain, it will accept any recipient
    if (CATCH_ALL) {
        try {
            await client.quit({ timeout: timeout });
        } catch (err) {}
        // prepare response
        Object.assign(response.domain, {
            accuracy: greylisted || isFreeMail(response.domain) ? MEDIUM : LOW,
            reason: "Catch-all domain",
        });
        // resolve
        return Promise.resolve(response);
    }

    // check for invalid recipients
    while (recipients.length) {
        const recipient = recipients.shift();
        // Send a RCPT TO command to every recipient
        await client
            .rcpt({
                to: recipient + "@" + domain,
                timeout: timeout,
            })
            .then()
            .catch((err) => {
                response.recipients.invalid.push({
                    local_part: recipient,
                    error: [err.code || null, err.enhancedCode || null].join(
                        "-"
                    ),
                    accuracy: isSmtpGreylisted(err) ? MEDIUM : HIGH,
                });
            });
    }

    // rset & gracefully quit
    try {
        await client.rset({ timeout: timeout });
        await client.quit({ timeout: timeout });
    } catch (err) {}

    // if we got here we can resolve whatever response we have
    return Promise.resolve(response);
};

//
const isSmtpGreylisted = (err) => {
    // console.log(err);
    /*
    450 - Requested action not taken – The user’s mailbox is unavailable
    451 - Requested action aborted – Local error in processing
    452 - Too many emails sent or too many recipients
    */
    // if one of the codes above, we consider it greylisted
    if (err.code && [450, 451, 452].indexOf(err.code) > -1) {
        return true;
    }

    /*
    if the error is a 5.7* code or contains blacklist|banned|denied|blocked|spam|abuse|deferred
    we can't communicate with the SMTP because they're probably blocking our IP
    */
    // separate codeblocks for the sake of readability

    const erregex = /(blacklist|banned|denied|blocked|spam|abuse|deferred)/i;
    if (err.message && erregex.test(err.message)) {
        return true;
    }
    // check error message
    if (err.message && err.message.startsWith("5.7")) {
        return true;
    }
    // check enhanced code
    if (err.enhancedCode && err.enhancedCode.startsWith("5.7")) {
        return true;
    }
    // defaults to false
    return false;
};

module.exports = {
    validateEmail,
    validateDomain,
    validateFormat,
    isDisposable,
    isFreeMail,
    isRoleMail,
};
