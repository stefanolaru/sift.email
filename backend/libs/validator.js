const dns = require("dns"),
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
    //
    // check domain dns
    const mxs = await mxQuery(result.domain)
        .then()
        .catch((err) => {
            // console.log(err);
            return [];
        });

    // return error if no MX
    if (!mxs || !mxs.length) {
        Object.assign(result, {
            error: "No MX entries",
        });
        return result;
    }

    // append disposable & free checks
    return Object.assign(result, {
        is_disposable: isDisposable(result.domain),
        is_free_email: isFreeMail(result.domain),
        is_role: isRoleMail(result.local_part),
    });
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

module.exports = {
    validateEmail,
    checkFormat,
    mxQuery,
    isDisposable,
    isFreeMail,
    isRoleMail,
};
