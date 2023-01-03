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
 * Validates a single email recipient
 * @param {*} email
 * @returns object
 */
const validateEmail = async (input) => {
    // verify format
    const result = checkFormat(input);

    // return early on error
    if (result.error)
        return {
            email: input,
            error: result.error,
        };

    // passed format validation, append disposable & free checks
    Object.assign(result, {
        is_disposable: isDisposable(result.domain),
        is_free_email: isFreeMail(result.domain),
        is_role: isRoleMail(result.local_part),
    });

    // check MX & SMTP
    if (!result.is_disposable && !result.is_role) {
        await validateDomain(result.domain, [result.local_part], 3000)
            .then((res) => {
                if (res.domain) {
                    Object.assign(result, {
                        error: res.domain,
                    });
                } else if (res.recipients) {
                    Object.assign(result, {
                        error: "Invalid email",
                    });
                }
            })
            .catch((err) => {
                console.log(err);
            });
    }

    return result;
};
/**
 *
 * @param {*} email
 * returns email & email parts
 */
const checkFormat = (email) => {
    //
    const email_regex =
        /^[-!#$%&'*+\/0-9=?A-Z^_a-z`{|}~](\.?[-!#$%&'*+\/0-9=?A-Z^_a-z`{|}~])*@[a-zA-Z0-9](-*\.?[a-zA-Z0-9])*\.[a-zA-Z](-?[a-zA-Z0-9])+$/;

    // check for email
    if (!email) {
        return { error: "Email not provided" };
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
        connected = false;

    // check domain MX entries
    let mxs = await mxQuery(domain, timeout)
        .then()
        .catch((err) => {
            return [];
        });

    // return error if no MX
    if (!mxs || !mxs.length) {
        return Promise.resolve({
            domain: "MX",
        });
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
                return false;
            });
    }

    // stop if still not connected
    if (!connected) {
        return Promise.resolve({
            domain: "CONNECT",
        });
    }

    // Send a HELO/EHLO command
    const HELO = await client
        .greet({ timeout: timeout })
        .then(() => true)
        .catch((err) => false);

    // stop if HELO doesn't go through
    if (!HELO) {
        try {
            await client.quit({ timeout: timeout });
        } catch (err) {}
        return Promise.resolve({
            domain: "EHLO",
        });
    }

    // Send a MAIL FROM command
    const MAIL = await client
        .mail({
            from: process.env.EMAIL_FROM_ADDRESS,
            timeout: timeout,
        })
        .then(() => true)
        .catch((err) => false);

    // stop if MAIL doesn't go through
    if (!MAIL) {
        try {
            await client.quit({ timeout: timeout });
        } catch (err) {}
        return Promise.resolve({
            domain: "MAIL",
        });
    }

    // Send a RCPT TO command to a random recipient
    const CATCH_ALL = await client
        .rcpt({
            to: "catch-all-" + Date.now() + "@" + domain,
            timeout: timeout,
        })
        .then(() => true)
        .catch(() => false);

    // stop if it's a catch all domain, it will accept any recipient
    if (CATCH_ALL) {
        try {
            await client.quit({ timeout: timeout });
        } catch (err) {}
        // resolve
        return Promise.resolve({
            domain: "CATCH_ALL",
        });
    }

    // check for invalid recipients
    const invalid = [];
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
                invalid.push({
                    local_part: recipient,
                    error: err.code || null,
                });
            });
    }

    // rset & gracefully quit
    try {
        await client.rset({ timeout: timeout });
        await client.quit({ timeout: timeout });
    } catch (err) {}

    // resolve empty object if no invalid recipients
    return Promise.resolve(
        invalid.length
            ? {
                  recipients: invalid,
              }
            : {}
    );
};

module.exports = {
    validateEmail,
    validateDomain,
    checkFormat,
    mxQuery,
    isDisposable,
    isFreeMail,
    isRoleMail,
};
