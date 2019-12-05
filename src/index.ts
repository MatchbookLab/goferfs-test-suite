import { Gofer } from 'goferfs';
import { IAdapter, Visibility } from 'goferfs/types';
import { Readable } from 'stream';

export function goferTests<TAdapter>(adapter: IAdapter<TAdapter>) {
  let prefix: string;
  let gofer: Gofer<TAdapter>;

  before(() => {
    // tests may be run concurrently, so need to prefix files
    prefix = '' + Math.ceil(Math.random() * 100000);
    gofer = new Gofer<TAdapter>(adapter);
  });

  describe('The Basics', () => {
    it('should get adapter name', () => {
      expect(gofer.adapterName).toBeTruthy();
      expect(gofer.adapterName).toEqual(adapter.adapterName);
    });

    it('should write and read', async () => {
      await gofer.write(`${prefix}-test.txt`, 'Hello, friend!');

      expect((await gofer.exists(`${prefix}-test.txt`))).toEqual(true);

      const { contents } = await gofer.read(`${prefix}-test.txt`, { encoding: 'utf8' });
      expect(contents).toEqual('Hello, friend!');
    });

    it('should delete', async () => {
      await gofer.delete(`${prefix}-test.txt`);

      expect((await gofer.exists(`${prefix}-test.txt`))).toEqual(false);
    });

    it('should create path to file', async () => {
      await gofer.write(`${prefix}-path/to/test.txt`, 'Test');

      expect((await gofer.exists(`${prefix}-path/to/test.txt`))).toEqual(true);
    });

    it('should delete a directory', async () => {
      await gofer.deleteDir(`${prefix}-path`);

      expect((await gofer.exists(`${prefix}-path/to/test.txt`))).toEqual(false);
    });

    it('should overwrite contents of existing files', async () => {
      await gofer.write(`${prefix}-path/overwrite.txt`, 'Old Contents');
      await gofer.write(`${prefix}-path/overwrite.txt`, 'New Contents');

      const { contents } = await gofer.read(`${prefix}-path/overwrite.txt`, { encoding: 'utf8' });
      expect(contents).toEqual('New Contents');
    });
  });

  describe('The Fun', () => {
    afterEach(async () => {
      await gofer.deleteDir(`${prefix}-path`);

      // @TODO maybe update this to do more specific check (not storages don't support directories)
      expect((await gofer.exists(`${prefix}-path`))).toEqual(false);
    });

    it('should move', async () => {
      await gofer.write(`${prefix}-path/to/test1.txt`, 'Test');
      await gofer.move(`${prefix}-path/to/test1.txt`, `${prefix}-path/to/test2.txt`);

      expect((await gofer.exists(`${prefix}-path/to/test1.txt`))).toEqual(false);
      expect((await gofer.exists(`${prefix}-path/to/test2.txt`))).toEqual(true);
      expect((await gofer.read(`${prefix}-path/to/test2.txt`, { encoding: 'utf8' })).contents).toEqual('Test');
    });

    it('should copy', async () => {
      await gofer.write(`${prefix}-path/to/test1.txt`, 'Test');
      await gofer.copy(`${prefix}-path/to/test1.txt`, `${prefix}-path/to/test2.txt`);

      expect((await gofer.exists(`${prefix}-path/to/test1.txt`))).toEqual(true);
      expect((await gofer.exists(`${prefix}-path/to/test2.txt`))).toEqual(true);
      expect((await gofer.read(`${prefix}-path/to/test1.txt`, { encoding: 'utf8' })).contents).toEqual('Test');
      expect((await gofer.read(`${prefix}-path/to/test2.txt`, { encoding: 'utf8' })).contents).toEqual('Test');
    });

    it('should return full metadata', async () => {
      await gofer.write(`${prefix}-path/to/test1.txt`, 'Test');
      const file = await gofer.read(`${prefix}-path/to/test1.txt`, { encoding: 'utf8' });

      expect(file.contents).toEqual('Test');
      expect(file.name).toEqual('test1.txt');
      expect(file.ext).toEqual('.txt');
      expect(file.path).toEqual(`${prefix}-path/to/test1.txt`);
      expect(file.parentDir).toEqual(`${prefix}-path/to`);
      expect(file.visibility).toEqual(Visibility.Public);
      expect(file.size).toEqual(4);
      expect(file.isFile).toEqual(true);
      expect(file.isDir).toEqual(false);
      expect(file.timestamp).toBeInstanceOf(Date);
      expect(file.mimetype).toEqual('text/plain');
    });

    it('should do streams', async () => {
      const inputStream = new Readable();

      inputStream.push('Test Stream');
      inputStream.push(null);

      await gofer.writeStream(`${prefix}-path/to/test-stream.txt`, inputStream);

      const { stream } = await gofer.readStream(`${prefix}-path/to/test-stream.txt`, { encoding: 'utf8' });

      const contents = await new Promise((resolve, reject) => {
        let str = '';
        stream.on('data', (chunk: string) => str += chunk);
        stream.on('end', () => resolve(str));
        stream.on('error', reject);
      });

      expect(contents).toEqual('Test Stream');
    });

    it('should override contents with streams', async () => {
      const inputStreamOld = new Readable();

      inputStreamOld.push('Old Stream Contents');
      inputStreamOld.push(null);

      await gofer.writeStream(`${prefix}-path/overwrite-stream.txt`, inputStreamOld);

      const inputStreamNew = new Readable();

      inputStreamNew.push('New Stream Contents');
      inputStreamNew.push(null);

      await gofer.writeStream(`${prefix}-path/overwrite-stream.txt`, inputStreamNew);

      const { contents } = await gofer.read(`${prefix}-path/overwrite-stream.txt`, { encoding: 'utf8' });
      expect(contents).toEqual('New Stream Contents');
    });


    it('should get visibility', async () => {
      await gofer.write(`${prefix}-path/to/test.txt`, 'Test', { visibility: Visibility.Public });

      expect((await gofer.getVisibility(`${prefix}-path/to/test.txt`))).toEqual(Visibility.Public);
    });

    it('should set visibility', async () => {
      await gofer.write(`${prefix}-path/to/test.txt`, 'Test', { visibility: Visibility.Public });

      await gofer.setVisibility(`${prefix}-path/to/test.txt`, Visibility.Private);
      expect((await gofer.getVisibility(`${prefix}-path/to/test.txt`))).toEqual(Visibility.Private);
    });

    it('should throw if an invalid visibility is provided', () => {
      expect(async () => {
        await gofer.setVisibility(`${prefix}-path/to/test.txt`, 13 as Visibility);
      }).toThrow('Unsupported Visibility: 13');
    });
  });

  describe('The Encoding', () => {
    const message = 'This is a base64 encoded message';
    const base64Message: string = 'VGhpcyBpcyBhIGJhc2U2NCBlbmNvZGVkIG1lc3NhZ2U=';

    afterEach(async () => {
      await gofer.deleteDir(`${prefix}-path`);

      // @TODO maybe update this to do more specific check (not storages don't support directories)
      expect((await gofer.exists(`${prefix}-path`))).toEqual(false);
    });

    it('should handle non-utf8 encoding', async () => {
      await gofer.write(`${prefix}-path/to/test.txt`, base64Message, { encoding: 'base64' });

      const { contents: base64 } = await gofer.read(`${prefix}-path/to/test.txt`, { encoding: 'base64' });
      expect(base64).toEqual(base64Message);

      const { contents: utf8 } = await gofer.read(`${prefix}-path/to/test.txt`, { encoding: 'utf8' });
      expect(utf8).toEqual(message);
    });

    it('should handle non-utf8 encoding with streams', async () => {
      await gofer.write(`${prefix}-path/to/test-stream-base64.txt`, base64Message, { encoding: 'base64' });

      const { stream: base64Stream } = await gofer.readStream(`${prefix}-path/to/test-stream-base64.txt`, { encoding: 'base64' });
      const base64 = await new Promise((resolve, reject) => {
        let str = '';
        base64Stream.on('data', (chunk: string) => str += chunk);
        base64Stream.on('end', () => resolve(str));
        base64Stream.on('error', reject);
      });

      // expect(base64).toEqual(base64Message, 'base64 string mismatch');

      const { stream: utf8Stream } = await gofer.readStream(`${prefix}-path/to/test-stream-base64.txt`, { encoding: 'utf8' });
      const utf8 = await new Promise((resolve, reject) => {
        let str = '';
        utf8Stream.on('data', (chunk: string) => str += chunk);
        utf8Stream.on('end', () => resolve(str));
        utf8Stream.on('error', reject);
      });

      expect(utf8).toEqual(message);
    });


    it('should handle buffers as input', async () => {
      const buffer = new Buffer(message, 'utf8');

      await gofer.write(`${prefix}-path/to/test.txt`, buffer);

      const { contents } = await gofer.read(`${prefix}-path/to/test.txt`, { encoding: 'utf8' });

      expect(contents).toEqual(message);
    });

    it('should handle buffers as input (2)', async () => {
      const buffer = new Buffer(base64Message, 'base64');

      await gofer.write(`${prefix}-path/to/test.txt`, buffer);

      const { contents } = await gofer.read(`${prefix}-path/to/test.txt`, { encoding: 'utf8' });

      expect(contents).toEqual(message);
    });

    it('should handle ignoring encoding for buffers', async () => {
      const buffer = new Buffer(base64Message, 'base64');

      await gofer.write(`${prefix}-path/to/test.txt`, buffer, { encoding: 'latin1' });

      const { contents } = await gofer.read(`${prefix}-path/to/test.txt`, { encoding: 'utf8' });

      expect(contents).toEqual(message);
    });

    it('should handle buffers as output', async () => {
      await gofer.write(`${prefix}-path/to/test.txt`, message, { encoding: 'utf8' });

      const { contents } = await gofer.read(`${prefix}-path/to/test.txt`);

      expect(contents).toBeInstanceOf(Buffer);
      expect((contents.toString())).toEqual('ASCII text, with no line terminators');
    });
  });
}
