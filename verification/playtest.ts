// Development-only entry; never included in the production build.
import { startGame } from '../src/bootstrap.ts';
import { validateWorld, migrateWorld } from '../src/domain/world.ts';
import type { World } from '../src/domain/world.ts';
import oldCheckpoints from './chapter2-checkpoints.json';
import bakeryCheckpoints from './chapter3-checkpoints.json';
import capacityCheckpoints from './capacity-checkpoints.json';
import operationsCheckpoints from './operations-checkpoints.json';
const checkpoints={...oldCheckpoints,...bakeryCheckpoints,...capacityCheckpoints,...operationsCheckpoints};
const name=new URLSearchParams(location.search).get('checkpoint')??'packing';
const saved=(checkpoints as unknown as Record<string,World>)[name];
if(!saved)throw new Error('Unknown checkpoint');
const world=migrateWorld(structuredClone(saved));world.player.path=[];world.navigationTarget=null;world.events=[];
validateWorld(world);startGame(world,false);
const banner=document.createElement('div');banner.textContent='独立试玩检查 · '+name;
banner.style.cssText='position:fixed;bottom:4px;left:50%;transform:translateX(-50%);font:10px sans-serif;color:#fff6d6;pointer-events:none';document.body.append(banner);
