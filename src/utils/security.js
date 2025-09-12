const { URL } = require('url');

exports.isValidUrl = (urlString) => {
  try {
    const parsedUrl = new URL(urlString);

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return false;
    }

    const { hostname } = parsedUrl;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.')) {
        return false;
    }

    return true;
  } catch (error) {
    return false;
  }
};

exports.isPlaylistUrl = (urlString) => {
  try {
    const parsedUrl = new URL(urlString);
    const playlistRegex = /(\?|&)list=|(\/playlists\/)/;
    return playlistRegex.test(parsedUrl.search) || playlistRegex.test(parsedUrl.pathname);
  } catch (error) {
    return false;
  }
};

exports.isUuid = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};