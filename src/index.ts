import net from 'node:net';

type DovecotAuthOptions = {
  socketPath?: string;
  service?: string;
  timeout?: number;
}

type DovecotResponse = {
    status: string;
    args: string[];
}

type AuthState = 'initial' | 'sent-cpid' | 'auth-requested' | 'done';

/**
 * tokenize a Dovecot auth response line.
 */
const tokenize = (line: string): string[] => line.trim().split('\t');

/**
 *  fsm automata transition logic for parsing Dovecot socket replies.
 */
export function transition(
  state: AuthState,
  line: string,
  socket: net.Socket,
  username: string,
  password: string,
  service: string,
  killTimeout: NodeJS.Timeout,
  resolve: (val: boolean) => void
): AuthState {
  const tokens = tokenize(line);
  const [command] = tokens;

  switch (state) {
    case 'initial':
      if (command === 'OK') {
        socket.write(`CPID\t${process.pid}\n`);
        return 'sent-cpid';
      }
      break;
    case 'sent-cpid': {
      const resp = Buffer.from(`${username}\0${username}\0${password}`).toString('base64');
      socket.write(`AUTH\t1\tPLAIN\tservice=${service}\tresp=${resp}\n`);
      return 'auth-requested';
    }
    case 'auth-requested':
      if (command === 'OK') {
        clearTimeout(killTimeout);
        socket.end();
        resolve(true);
        return 'done';
      } else if (command === 'FAIL' || command === 'NOTFOUND') {
        clearTimeout(killTimeout);
        socket.end();
        resolve(false);
        return 'done';
      }
      break;
  }
  return state;
}

/**
 * authenticate a user against Dovecot's auth-client socket.
 *
 * @param username - the username to authenticate.
 * @param password - the password to authenticate.
 * @param options - optional configuration.
 * @returns resolves true if auth succeeded, false if not.
 */
export async function dovecotAuth(
  username: string,
  password: string,
  options: DovecotAuthOptions = {}
): Promise<boolean> {
  const {
    socketPath = '/var/run/dovecot/auth-client',
    service = 'smtp',
    timeout = 3000
  } = options;

  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ path: socketPath });
    let state: AuthState = 'initial';
    let timedOut = false;

    const killTimeout = setTimeout(() => {
      timedOut = true;
      socket.destroy();
      reject(new Error('Dovecot auth timed out'));
    }, timeout);

    socket.on('connect', () => {
      socket.write(`VERSION\t1\t0\n`);
    });

    socket.on('data', (chunk: Buffer) => {
      const lines = chunk.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        state = transition(state, line, socket, username, password, service, killTimeout, resolve);
        if (state === 'done') break;
      }
    });

    socket.on('error', (err: Error) => {
      if (!timedOut) {
        clearTimeout(killTimeout);
        reject(err);
      }
    });

    socket.on('end', () => {
      clearTimeout(killTimeout);
    });
  });
}

const defaultExport = { dovecotAuth };
export default defaultExport;
