var readline = require('readline');
var fs = require('fs');

// var FILE_PATH = '/var/log/' + (process.argv[2] || 'mail.log');
var FILE_PATH = './' + (process.argv[2] || 'mail.log');
var users = [];
var lineReader = readline.createInterface({
  input: fs.createReadStream(FILE_PATH)
});

console.info('File path: ', FILE_PATH);

lineReader.on('line', function onLineUsers(line) {
  var saslUsername = line.match(/sasl_username=(.*)/);
  var user;
  var code;
  if (!saslUsername) {
    return;
  }

  user = getUser(saslUsername[1]);
  user.count++;

  code = line.match(/[A-Z0-9]{10}/);
  user.codes.push(code[0]);
});

lineReader.on('close', function onCloseUsers() {
  readOccurrences();
});


function getUser(username) {
  var user = null;
  users.some(function someUser(u) {
    if (u.name === username) {
      user = u;
      return true;
    }
    return false;
  });

  if (!user) {
    user = {
      name: username,
      count: 0,
      occurrences: [],
      codes: [],
      ips: [],
      froms: [],
      tos: []
    };

    users.push(user);
  }
  return user;
}


// //////////////////////////////////


function readOccurrences() {
  var postfixDataRegex = /([A-Z][a-z]{2}\s+[0-9]{1,2} [0-9]{2}:[0-9]{2}:[0-9]{2}) .* postfix\/(.*)\[([0-9]+)\]/;
  var hostIpRegex = /client=(.*?)\[([0-9\.]+)\]/i;
  var emailToRegex = /to=<(.*?)>/i;
  var emailFromRegex = /from=<(.*?)>/i;

  lineReader = readline.createInterface({
    input: fs.createReadStream(FILE_PATH)
  });

  lineReader.on('line', function onLineOcurrence(line) {
    var matchedCode = line.match(/[A-Z0-9]{10}/);
    var code;

    if (!matchedCode || !matchedCode[0]) {
      return;
    }

    code = matchedCode[0];
    users.forEach(function onEachUser(user) {
      var matchedData;
      var occurrence;
      var hostIp;
      var email;

      if (user.codes.indexOf(code) === -1) {
        return;
      }

      matchedData = line.match(postfixDataRegex);

      if (!matchedData) {
        console.log('error: ', line);
        return;
      }

      occurrence = getOccurrence(code, matchedData, user);

      switch (matchedData[2]) {
        case 'smtpd':
          hostIp = line.match(hostIpRegex);

          if (hostIp) {
            occurrence.ip.push(hostIp[2]);
            userAddIp(user, hostIp[2]);
          }
          break;

        case 'qmgr':
          email = line.match(emailFromRegex);

          if (email && email[1]) {
            occurrence.from.push(email[1]);
            userAddFrom(user, email[1]);
          } else if (line.indexOf('removed') === -1) {
            console.log('************** email FROM not found: ', line);
          }
          break;

        case 'pipe':
          email = line.match(emailToRegex);

          if (email && email[1]) {
            occurrence.to.push(email[1]);
            userAddTo(user, email[1]);
          } else {
            console.log('************** email TO not found: ', line);
          }
          break;

        default: break;
      }
    });
  });


  lineReader.on('close', function onCloseOcurrence() {
    ordenar();
    printResult();
    process.exit(0);
  });


  function getOccurrence(code, matchedData, user) {
    var occurrence = null;

    user.occurrences.some(function someOcurrence(oc) {
      if (oc.code === code) {
        occurrence = oc;
        return true;
      }
      return false;
    });

    if (!occurrence) {
      occurrence = {
        code: code,
        date: matchedData[1],
        // module: matchedData[2],
        pid: matchedData[3],
        from: [],
        to: [],
        ip: []
      };

      user.occurrences.push(occurrence);
    }
    return occurrence;
  }
}


// ///////////////////////////


function ordenar() {
  users.sort(function usersSort(a, b) {
    if (a.tos.length > b.tos.length) {
      return -1;
    }

    if (a.tos.length < b.tos.length) {
      return 1;
    }

    return 0;
  });
}


function userAddIp(user, ip) {
  if (user.ips.indexOf(ip) === -1) {
    user.ips.push(ip);
  }
}

function userAddTo(user, email) {
  if (user.tos.indexOf(email) === -1) {
    user.tos.push(email);
  }
}

function userAddCode(user, code) {
  if (user.codes.indexOf(oc.code) === -1) {
    user.codes.push(oc.code);
  }
}

function userAddFrom(user, email) {
  if (user.froms.indexOf(email) === -1) {
    user.froms.push(email);
  }
}


function printResult() {
  users.forEach(function printUser(user) {
    console.log('=====================================\n');
    console.log(user.count, user.name);
    console.log( '\n ** FROM:\n   ', user.froms.join('\n    ') );
    console.log( '\n ** IPs:\n   ', user.ips.join('\n    ') );
    console.log( '\n ** TO:', user.tos.length, '\n   ', user.tos.join('\n    ') );
    console.log('\n\n\n\n');
  });
}
