const cache = new Map();

function set(key, value, ttl) {
    const expires = Date.now() + ttl;
    cache.set(key, { value, expires });
}

function get(key) {
    const data = cache.get(key);
    if (!data) {
        return null;
    }

    if (Date.now() > data.expires) {
        cache.delete(key);
        return null;
    }

    return data.value;
}

module.exports = { set, get };