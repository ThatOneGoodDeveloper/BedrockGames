/*global Ultraviolet*/
(function () {
  var here = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || self.location.href;
  var path = new URL(here).pathname;
  var i = path.lastIndexOf('/proxy/');
  var dir = i === -1 ? '/proxy/' : path.slice(0, i + 7);
  self.__uv$config = {
    prefix: dir + 'uv/',
    encodeUrl: Ultraviolet.codec.xor.encode,
    decodeUrl: Ultraviolet.codec.xor.decode,
    handler: dir + 'portal/uv.handler.js',
    client: dir + 'portal/uv.client.js',
    bundle: dir + 'portal/uv.bundle.js',
    config: dir + 'portal/uv.config.js',
    sw: dir + 'portal/uv.sw.js',
  };
})();
