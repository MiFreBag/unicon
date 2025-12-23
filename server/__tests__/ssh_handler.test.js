jest.mock('ssh2', () => {
  const { EventEmitter } = require('events');
  class MockStream extends EventEmitter {
    write(data) { this.emit('wrote', data); }
    end() { this.emit('end'); }
    setWindow() {}
  }
  class Client extends EventEmitter {
    constructor() { super(); this._connected = false; }
    connect(opts) {
      process.nextTick(() => this.emit('ready'));
      this._connected = true;
    }
    end() { this._connected = false; this.emit('close'); }
    exec(command, _opts, cb) {
      const stream = new MockStream();
      cb && cb(null, stream);
      process.nextTick(() => {
        stream.emit('data', Buffer.from('ok'));
        stream.emit('close', 0, null);
      });
    }
    sftp(cb) {
      const sftp = {
        readdir: (path, cb2) => cb2(null, [{ filename: 'file.txt', longname: '-rw-r--r-- 1 u g 0 file.txt', attrs: {} }]),
        createReadStream: () => {
          const rs = new EventEmitter();
          process.nextTick(() => {
            rs.emit('data', Buffer.from('hello'));
            rs.emit('end');
          });
          return rs;
        },
        createWriteStream: () => {
          const ws = new EventEmitter();
          process.nextTick(() => ws.emit('finish'));
          return ws;
        }
      };
      cb && cb(null, sftp);
    }
  }
  return { Client };
});

global.broadcast = jest.fn();

const SSHHandler = require('../handlers/ssh_handler');

describe('SSHHandler', () => {
  test('connect, exec, sftp list/get/put', async () => {
    const h = new SSHHandler('conn-1', { host: 'x', username: 'u', password: 'p' });
    await expect(h.connect()).resolves.toEqual({ success: true });

    const execRes = await h.exec('echo ok');
    expect(execRes.success).toBe(true);
    expect(execRes.data.stdout).toContain('ok');

    const listRes = await h.sftpList({ path: '.' });
    expect(listRes.success).toBe(true);
    expect(Array.isArray(listRes.data.entries)).toBe(true);

    const getRes = await h.sftpGet({ path: './file.txt' });
    expect(getRes.success).toBe(true);
    expect(getRes.data.base64).toBeDefined();

    const putRes = await h.sftpPut({ path: './upload.txt', base64: Buffer.from('hi').toString('base64') });
    expect(putRes.success).toBe(true);

    await expect(h.disconnect()).resolves.toEqual({ success: true });
  });
});
