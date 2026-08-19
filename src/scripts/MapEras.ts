/**
 * The map's caption: one line per stretch of years, saying what that stretch
 * was actually like.
 *
 * Eras, not a manifest. The giant year watermark on the canvas already says
 * *when*, so these lines carry what the watermark cannot, and they are printed
 * directly beneath it as its subtitle.
 *
 * Each line has to stand on its own, and it has to sound like someone telling
 * you about it rather than listing it. Whoever is reading has just met a few
 * hundred dots they cannot possibly parse yet, and this is the only text on the
 * map that explains anything.
 *
 * Three failures to avoid, all of which these lines have already been through.
 *
 * A line that only parses once you have clicked into the graph ("one more
 * matchmaking site") does nothing for the person who most needs it. A line that
 * reports an achievement ("First paying client at fifteen") is a resume bullet:
 * technically informative, and silent on why any of it happened. And a line
 * assembled out of a node's title and tagline ("a platform watching a dozen
 * live broadcast streams") reads as fluent and says nothing, because *streams*
 * with no context could mean anything, and the writer never found out what the
 * work actually was.
 *
 * The last one is the expensive failure and the only fix is to go read the node
 * bodies in full. Do that and the era writes itself: 2007-2009 is not a YouTube
 * channel, it is a twelve-year-old rebuilding a commercial rewards site from
 * the outside to find out how it worked. 2014-2015 is not "college", it is a
 * game shipping without a custom-game browser and someone building the missing
 * one over Christmas. Every line here opens on the situation rather than the
 * credential, and where the anecdote and the tidier claim disagree, the
 * anecdote wins.
 *
 * They live in their own module because two places need the same words. map.ts
 * renders the era covering the current focus into an overlay that is
 * aria-hidden, because it is rewritten whenever the timeline moves and a region
 * that rewrites itself under a reader is worse than one they never reach.
 * index.astro renders the same lines into the page as static markup so the
 * content exists for everyone. Keeping two hand-maintained copies of ten
 * biographical sentences would drift, so there is one.
 */

/** Inclusive year range, then the sentence describing it. */
export type Era = [from: number, to: number, text: string];

export const ERAS: Era[] = [
  [2003, 2006, 'My dad put up a website for me, and I learned by editing working code I didn\'t write, changing things until they broke or improved.'],
  [2007, 2009, 'Everything took me hours to figure out and minutes to explain, so at twelve I started a tutorial channel. It ended up with 1.24M views.'],
  [2010, 2011, 'My first paying clients came at fifteen. So did the Lockerz race: prizes gone in seconds, I automated everything, then shipped only the alarm.'],
  [2012, 2013, 'Playing Minecraft adventure maps with friends meant renting a server, so nobody did. I made it one click; a million-plus sessions at sixteen.'],
  [2014, 2015, 'College: I ran the newspaper and radio station\'s sites, and built the lobby browser Halo 5 shipped without. 343 added their own two years later.'],
  [2016, 2018, 'At Turner I learned a live TV stream can serve valid data while frozen on screen, so I spent a summer building a monitor for a dozen feeds.'],
  [2019, 2020, 'I moved live TV streaming onto Kubernetes at WarnerMedia, then went home to my own cluster. My first home automations were server alerts, not lights.'],
  [2021, 2023, 'Chip shortage years: AT&T Azure migrations by day, Fast Alerts by night. Free alerts for 200,000 people; we blocked 95,000 scalper accounts.'],
  [2024, 2025, 'At Harris, new infrastructure took five days of specialist time, a price nobody pays for an experiment. My modules got it under ten minutes.'],
  [2026, 2026, 'Harris platform work by day. By night: 28 projects in 8 months on my own cloud, and a broker I built so agents can use my secrets but never see them.'],
];

/** "2014-2015", or a single year when an era covers one. */
export const eraSpan = ([a, b]: Era) => (a === b ? `${a}` : `${a}-${b}`);

/**
 * The era covering a moment, read from the same epoch-ms `focus` the watermark
 * renders its year from. One source for both is the point: when the caption
 * came from a schedule index and the year came from `focus`, the two could
 * disagree, and did, for the whole beat that exists so the sentence can be read
 * against a still frame.
 *
 * Total rather than nullable. The ranges are contiguous, so only a year outside
 * them can miss, and clamping to the nearest end beats giving the caption an
 * empty state for a case the timeline's own bounds already prevent.
 */
export const eraFor = (ms: number): Era =>
  ERAS.find((e) => new Date(ms).getUTCFullYear() <= e[1]) ?? ERAS[ERAS.length - 1];
