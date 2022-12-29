const { SMTPClient } = require("smtp-client");
/**
 *
 * @param {*} domain
 * @param {*} mxEntries
 * @param {*} timeout
 * @returns SMTP client instance & domain check results
 */
const checkDomain = async (domain, mxEntries, timeout = 3000) => {
    // vars
    let client = null,
        connected = false,
        result = { domain: domain };

    // stop if no mx records
    if (!mxEntries.length) {
        result["error"] = {
            message: "Mx errror",
        };
        //
        return {
            client,
            result,
        };
    }

    // only attempt to connect to the first 2 mx records
    mxEntries = mxEntries.slice(0, 2);

    while (!connected && mxEntries.length) {
        const mx = mxEntries.shift();
        // set connection settings
        client = new SMTPClient({
            host: mx.exchange,
            port: 25,
        });

        // connect to mx
        await client
            .connect({ timeout: timeout })
            .then((res) => {
                connected = true;
            })
            .catch((err) => {
                result["greylisted"] = isSmtpGreylisted(err) ? true : false;
                result["error"] = {
                    message: err.message,
                    code: err.code || null,
                };
            });
    }

    //
    if (!connected) {
        return { client, result };
    }

    // greet
    await client
        .greet({ timeout: timeout })
        .then((res) => {
            result["EHLO"] = true;
            // MAIL now
            return client.mail({ from: "info@sift.email", timeout: timeout });
        })
        .then((res) => {
            // responded ok to email
            result["MAIL"] = true;
        })
        .catch((err) => {
            result["greylisted"] = isSmtpGreylisted(err) ? true : false;
            result["error"] = {
                message: err.message,
                code: err.code || null,
            };
        });

    // didn't initiate a message transfer
    if (!result.MAIL) {
        // quit connection
        await client
            .quit({ timeout: timeout })
            .then()
            .catch((err) => {});

        client = null;
        return { client, result };
    }

    // check if the domain it's a catch all
    result["catchall"] = await client
        .rcpt({
            to: "catch-" + Date.now() + "-all@" + domain,
            timeout: timeout,
        })
        .then(() => true)
        .catch(() => {
            // on any error we assume it's not catch all
            return false;
        });

    // quit connection if catch all, thanks for nothing
    if (result.catchall) {
        // quit connection
        await client
            .quit({ timeout: timeout })
            .then()
            .catch((err) => {});
        // reset client
        client = null;
    }

    //
    return { client, result };
};

/**
 *
 * @param {*} client
 * @param {*} recipient
 * @param {*} timeout
 * @returns boolean - SMTP recipient validation response
 */
const checkRecipient = async (client, recipient, timeout) =>
    await client
        .rcpt({ to: recipient, timeout: timeout })
        .then(() => true)
        .catch((err) => {
            if (isSmtpTimeout(err)) {
                return null; // set null for unknown
            } else if (isSmtpGreylisted(err)) {
                return true;
            } else {
                return false;
            }
        });

//
const isSmtpGreylisted = (err) => {
    // grey codes
    const codes = [
        // 450 Requested mail action not taken: mailbox unavailable (e.g.,
        // mailbox busy or temporarily blocked for policy reasons)
        450,
        // 451 Requested action aborted: local error in processing
        451,
        // 452 Requested action not taken: insufficient system storage
        452,
    ];

    // if one of the codes above, it's greylisted
    if (err.code && codes.indexOf(err.code) > -1) {
        return true;
    }

    // if the error is a 5.7* it's likely our problem
    const errorRegex = /(blacklist|banned|denied|blocked|spam|abuse|deferred)/i;
    if (
        errorRegex.test(err.message) ||
        (err.enhancedCode && err.enhancedCode.startsWith("5.7")) ||
        (err.message && err.message.startsWith("5.7"))
    ) {
        return true;
    }

    return false;
};

const isSmtpTimeout = (err) => {
    if (
        !err.code &&
        !err.enhancedCode &&
        err.message == "Command has timed out"
    ) {
        return true;
    }
    return false;
};

module.exports = { checkDomain, checkRecipient };
