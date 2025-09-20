import { JsonRpcProvider, Block } from 'ethers';
import { logger } from './log.js';

async function getBlockSafe(provider: JsonRpcProvider, blockNumber: number): Promise<Block> {
  const block = await provider.getBlock(blockNumber);
  if (!block) {
    throw new Error(`Block ${blockNumber} not found`);
  }
  return block;
}

async function latestBlock(provider: JsonRpcProvider): Promise<{ number: number; timestamp: number }> {
  const number = await provider.getBlockNumber();
  const block = await getBlockSafe(provider, number);
  return { number, timestamp: block.timestamp };
}

async function findBlockAtOrBefore(provider: JsonRpcProvider, targetTimestamp: number): Promise<number> {
  const { number: latestNumber, timestamp: latestTimestamp } = await latestBlock(provider);
  if (targetTimestamp >= latestTimestamp) {
    return latestNumber;
  }
  let low = 0;
  let high = latestNumber;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const block = await getBlockSafe(provider, mid);
    if (block.timestamp === targetTimestamp) {
      return mid;
    }
    if (block.timestamp < targetTimestamp) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return Math.max(high, 0);
}

function endOfDayTimestamp(date: Date): number {
  return Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59) / 1000,
  );
}

function endOfHourTimestamp(date: Date): number {
  return Math.floor(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      date.getUTCHours(),
      59,
      59,
    ) / 1000,
  );
}

export async function blockAtEndOfDayUTC(provider: JsonRpcProvider, date?: Date): Promise<number> {
  const targetDate = date ?? new Date();
  const target = endOfDayTimestamp(targetDate);
  const blockNumber = await findBlockAtOrBefore(provider, target);
  logger.info(`Resolved end-of-day block ${blockNumber} for ${targetDate.toISOString().slice(0, 10)}`);
  return blockNumber;
}

export async function blockAtEndOfHourUTC(provider: JsonRpcProvider, date: Date): Promise<number> {
  const target = endOfHourTimestamp(date);
  const blockNumber = await findBlockAtOrBefore(provider, target);
  logger.info(
    `Resolved end-of-hour block ${blockNumber} for ${date.toISOString().slice(0, 13)}:00Z`,
  );
  return blockNumber;
}
