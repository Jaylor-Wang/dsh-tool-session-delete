import { register } from 'node:module';

register(new URL('./loader-hook.mjs', import.meta.url).href);
