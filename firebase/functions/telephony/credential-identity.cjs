'use strict';
function connectionId(credential) {
  const resource = /^connection:([0-9]+)$/.exec(credential?.resource_id || '')?.[1];
  const direct = credential?.connection_id;
  if (resource && direct && resource !== direct) throw new Error('Credential connection identifiers disagree.');
  if (!resource && !direct) throw new Error('Credential connection identity is missing.');
  return resource || direct;
}
module.exports = { connectionId };
