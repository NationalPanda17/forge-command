import { beforeEach, describe, expect, it } from 'vitest';
import { play, resetSounds, setGameSpeed, setQuietAtSpeed, soundFor } from '../../src/ui/sound';

describe('16.1 sound gate', () => {
  beforeEach(() => resetSounds());

  it('plays the month chime at most once every twenty seconds, however fast the clock runs', () => {
    // Arrange: at 8× a month passes every 3.75 seconds of real time.
    const months = [0, 3750, 7500, 11250, 15000, 18750, 22500];
    // Act
    const played = months.filter((t) => play('month', t));
    // Assert
    expect(played).toEqual([0, 22500]);
  });

  it('lets a weightier sound through at once but holds a lesser one back for a moment', () => {
    // Arrange: a blackout has just sounded.
    expect(play('blackout', 1000)).toBe(true);
    // Act and assert: good news right after is held; the rival is weightier and plays.
    expect(play('done', 1200)).toBe(false);
    expect(play('rival', 1300)).toBe(true);
    // Once the hold has passed, the lesser sound plays again.
    expect(play('done', 2500)).toBe(true);
  });

  it('never holds back the clicks of the controls', () => {
    // Arrange
    play('rival', 0);
    // Act and assert
    expect(play('click', 100)).toBe(true);
    expect(play('click', 120)).toBe(false); // the click's own 40 ms debounce
    expect(play('click', 200)).toBe(true);
  });

  it('leaves routine news to the log at 4× and 8×, but never an emergency', () => {
    // Arrange
    setQuietAtSpeed(true);
    setGameSpeed(8);
    // Act and assert
    expect(play('month', 0)).toBe(false);
    expect(play('done', 10)).toBe(false);
    expect(play('alarm', 20)).toBe(true);
    // At normal speed the month is heard again.
    setGameSpeed(1);
    expect(play('month', 30000)).toBe(true);
  });

  it('gives the silent moments a sound: a crisis, its end, a refused budget, a finished build', () => {
    // Act and assert
    expect(soundFor('Crisis: the Northern Ports crisis has begun.', 'bad')).toBe('alarm');
    expect(soundFor('The Northern Ports crisis has wound down.', 'good')).toBe('success');
    expect(soundFor('The Committee votes your request down and sets the budget at $200M a month.', 'bad')).toBe('failure');
    expect(soundFor('Corran Spur opens to traffic.', 'good')).toBe('done');
    expect(soundFor('A quiet month at the Board.', 'info')).toBeNull();
  });
});
