import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

import Gofer from 'goferfs';
import { Visibility } from 'goferfs/types';
import { IAdapter } from 'goferfs/types/interfaces';
import { Readable } from 'stream';

chai.use(chaiAsPromised);
chai.should();

// tests may be run concurrently, so need to prefix files
const prefix = Math.ceil(Math.random() * 100000);

export function goferTests(adapter: IAdapter) {
    const gofer = new Gofer(adapter);

    describe('The Basics', function () {
        it('should write and read', async () => {
            await gofer.write(`${prefix}-test.txt`, 'Hello, friend!');

            (await gofer.exists(`${prefix}-test.txt`)).should.equal(true, 'exists');

            const { contents } = await gofer.read(`${prefix}-test.txt`);
            contents.should.equal('Hello, friend!', 'contents');
        });

        it('should delete', async () => {
            await gofer.delete(`${prefix}-test.txt`);

            (await gofer.exists(`${prefix}-test.txt`)).should.equal(false, 'exists');
        });

        it('should create path to file', async () => {
            await gofer.write(`${prefix}-path/to/test.txt`, 'Test');

            (await gofer.exists(`${prefix}-path/to/test.txt`)).should.equal(true, 'exists');
        });

        it('should delete a directory', async () => {
            await gofer.deleteDir(`${prefix}-path`);

            (await gofer.exists(`${prefix}-path/to/test.txt`)).should.equal(false, 'exists');
        });

        it('should overwrite contents of existing files', async () => {
            await gofer.write(`${prefix}-path/overwrite.txt`, 'Old Contents');
            await gofer.write(`${prefix}-path/overwrite.txt`, 'New Contents');

            const { contents } = await gofer.read(`${prefix}-path/overwrite.txt`);
            contents.should.equal('New Contents', 'contents');
        });
    });

    describe('The Fun', function () {
        afterEach(async () => {
            await gofer.deleteDir(`${prefix}-path`);

            // @TODO maybe update this to do more specific check (not storages don't support directories)
            (await gofer.exists(`${prefix}-path`)).should.equal(false, 'exists');
        });

        it('should move', async () => {
            await gofer.write(`${prefix}-path/to/test1.txt`, 'Test');
            await gofer.move(`${prefix}-path/to/test1.txt`, `${prefix}-path/to/test2.txt`);

            (await gofer.exists(`${prefix}-path/to/test1.txt`)).should.equal(false, '"path/to/test1.txt" exists');
            (await gofer.exists(`${prefix}-path/to/test2.txt`)).should.equal(true, '"path/to/test2.txt" exists');
            (await gofer.read(`${prefix}-path/to/test2.txt`)).contents.should.equal('Test', '"path/to/test2.txt" contents');
        });

        it('should copy', async () => {
            await gofer.write(`${prefix}-path/to/test1.txt`, 'Test');
            await gofer.copy(`${prefix}-path/to/test1.txt`, `${prefix}-path/to/test2.txt`);

            (await gofer.exists(`${prefix}-path/to/test1.txt`)).should.equal(true, '"path/to/test1.txt" exists');
            (await gofer.exists(`${prefix}-path/to/test2.txt`)).should.equal(true, '"path/to/test2.txt" exists');
            (await gofer.read(`${prefix}-path/to/test1.txt`)).contents.should.equal('Test', '"path/to/test1.txt" contents');
            (await gofer.read(`${prefix}-path/to/test2.txt`)).contents.should.equal('Test', '"path/to/test2.txt" contents');
        });

        it('should return full metadata', async () => {
            await gofer.write(`${prefix}-path/to/test1.txt`, 'Test');
            const file = await gofer.read(`${prefix}-path/to/test1.txt`);

            file.contents.should.equal('Test', 'contents');
            file.name.should.equal('test1.txt', 'name');
            file.ext.should.equal('.txt', 'ext');
            file.path.should.equal(`${prefix}-path/to/test1.txt`, 'path');
            file.parentDir.should.equal(`${prefix}-path/to`, 'parentDir');
            file.visibility.should.equal(Visibility.Public, 'visibility');
            file.size.should.equal(4, 'size');
            file.isFile.should.equal(true, 'isFile');
            file.isDir.should.equal(false, 'isDir');
            file.timestamp.should.be.a('Date', 'timestamp');
            file.mimetype.should.equal('text/plain', 'mimetype');
        });

        it('should do streams', async () => {
            const inputStream = new Readable();

            inputStream.push('Test Stream');
            inputStream.push(null);

            await gofer.writeStream(`${prefix}-path/to/test-stream.txt`, inputStream);

            const { stream } = await gofer.readStream(`${prefix}-path/to/test-stream.txt`);

            const contents = await new Promise((resolve, reject) => {
                let str = '';
                stream.on('data', (chunk: string) => str += chunk);
                stream.on('end', () => resolve(str));
                stream.on('error', reject);
            });

            contents.should.equal('Test Stream', 'contents');
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

            const { contents } = await gofer.read(`${prefix}-path/overwrite-stream.txt`);
            contents.should.equal('New Stream Contents', 'contents');
        });


        it('should get visibility', async () => {
            await gofer.write(`${prefix}-path/to/test.txt`, 'Test', { visibility: Visibility.Public });

            (await gofer.getVisibility(`${prefix}-path/to/test.txt`)).should.equal(Visibility.Public, 'visibility');
        });

        it('should set visibility', async () => {
            await gofer.write(`${prefix}-path/to/test.txt`, 'Test', { visibility: Visibility.Public });

            await gofer.setVisibility(`${prefix}-path/to/test.txt`, Visibility.Private);
            (await gofer.getVisibility(`${prefix}-path/to/test.txt`)).should.equal(Visibility.Private, 'visibility');
        });

        it('should throw if an invalid visibility is provided', () => {
            return gofer.setVisibility(`${prefix}-path/to/test.txt`, 13 as Visibility).should.eventually.be.rejectedWith('Unsupported Visibility: 13');
        });
    });
}
