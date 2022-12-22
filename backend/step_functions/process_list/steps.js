// just export steps.json as string to DefinitionString
module.exports = () => {
    const fsPromises = require("fs").promises;
    return fsPromises.readFile(
        "backend/step_functions/process_list/steps.json",
        "utf-8"
    );
};
