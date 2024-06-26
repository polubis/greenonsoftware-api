const noEdgeSpacesRgx = /^\S(.*\S)?$/;
const dateRgx = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const usernameRgx = /^[a-zA-Z0-9_-]+$/;
const base64Rgx =
  /^\s*data:([a-zA-Z]+\/[a-zA-Z]+)?(;base64)?,[a-zA-Z0-9+/]+={0,2}\s*$/;

export { noEdgeSpacesRgx, dateRgx, usernameRgx, base64Rgx };
