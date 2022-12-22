// chunk array into pieces
module.exports.chunkArray = (arr, size) => {
    var chunks = [],
        i = 0,
        n = arr.length;

    while (i < n) {
        chunks.push(arr.slice(i, (i += size)));
    }
    return chunks;
};
