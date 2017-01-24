import { IAdapter } from 'goferfs/interfaces';

declare module 'goferfs-test-suite' {
    export function goferTests(adapter: IAdapter): void;
}
