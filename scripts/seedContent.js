/**
 * One-shot content seeder for BookAStay.
 *
 * WHY THIS EXISTS
 *   Seeding About / House Rules through the Supabase SQL Editor kept failing with
 *   `relation "the" does not exist` — not because the SQL was wrong (it wasn't),
 *   but because a *fragment* of the big House Rules text kept being sent to
 *   Postgres, which then read plain English ("...from the booker...") as SQL.
 *   Here the content is plain JS objects, so there are no SQL string literals to
 *   slice and that error is impossible.
 *
 * WHAT IT DOES  (idempotent — safe to re-run; never overwrites your admin edits)
 *   • Inserts / repairs About + House Rules            (site_content)
 *
 * NOTE: Properties are managed exclusively from the admin panel now, so this
 *       script no longer seeds any rooms. Add rooms via Admin → Properties.
 *
 * PREREQUISITE
 *   The tables must already exist — run database/01_tables.sql first.
 *
 * RUN
 *   node Backend/scripts/seedContent.js        (from the project root)
 *   node scripts/seedContent.js                (from the Backend folder)
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load Backend/.env no matter which directory this is run from, BEFORE importing
// supabase.js (which reads the env at import time).
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { supabaseAdmin } = await import('../services/supabase.js');

if (!supabaseAdmin) {
  console.error('\n✖ supabaseAdmin is not configured. Add SERVICE_ROLE_KEY to Backend/.env and retry.\n');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// DATA
// ---------------------------------------------------------------------------

const about = {
  paragraphs: [
    "Engeemos Bookastay Ventures is a registered business name. We currently oversee hosting services for <strong>Engeemos Bookastay Apartments</strong> a block of flats boasting of modern facilities and aesthetically styled interior. Ensconced in a serene and secure part of <strong>Olomore</strong>, Abeokuta, this property is close to Lafenwa, Ita-Oshin, Brewery, Ibara-Omida, Oke-Ilewo, and just about 20-25 minutes of driving to Kuto/Oke-Mosan area and Olusegun Obasanjo Presidential Library.",
    "Rare find tourist attraction centres like the recently revamped Olumo Rock, the Kuti Heritage Museum and the Adire Mall, Itoku are just few minutes of driving away.",
    "At <strong>Engeemos Bookastay</strong>, we put <strong>guests' satisfaction and privacy</strong> at the core of our service delivery, thus ensuring guests never felt like they have left their homes <strong>-a sharp contrast to the prevailing atmosphere at hotels</strong>.",
    "As part of our future plan, we intend to bring on board more verified, comfortable and guests-centric short stay accommodations.",
  ],
};

const houseRules = {
  rules: [
    {
      title: 'Shoes in the Living Room Area',
      category: 'Cleanliness',
      content: 'We prefer that shoes not be worn in the living room area, including on the centre rug.',
    },
    {
      title: 'Smoking',
      category: 'Health & Safety',
      content: 'Smoking of any kind is not permitted inside the apartment. If you need to smoke, please do so outside.',
    },
    {
      title: 'Parties',
      category: 'Entertainment',
      content: 'Parties are not allowed, although guests are welcome to play/listen to music in-house for self-entertainment purposes.',
    },
    {
      title: 'Number of Guests',
      category: 'Occupancy',
      content: "Number of guests (including children) must be clearly indicated during booking as only number of guests so indicated will be allowed to stay at the apartment. Being precise in this regard ensures we can appropriately prepare the apartment for guests' arrival. Your comfort and wellbeing is our priority!",
    },
    {
      title: 'Visitors',
      category: 'Guest Policy',
      content: 'Guests are free to have visitors over during their stay. However, visitors are not allowed to sleep over. Similarly, guests have the responsibility to ensure that their visitors do not breach the House Rules or break/damage anything in the apartment.',
    },
    {
      title: 'Entertainment and Games',
      category: 'Amenities',
      content: 'There is a 75-inch smart TV in the apartment. Feel free to binge your favourite TV shows and movies on Netflix and/or Amazon Prime. You can also stream videos on YouTube.',
      extra: 'Board games like snake-and-ladder, chess, ludo, and scrabble together with opon ayo are available and can be found inside the cabinet below the TV.',
    },
    {
      title: 'Lights',
      category: 'Energy Conservation',
      content: "The lighting system in the apartment is made for beautification. Feel free to use them. However, once it is past 3pm (when the sun's intensity would have reduced), only switch on the light when needed.",
    },
    {
      title: 'Power Supply Arrangement',
      category: 'Electricity',
      content: 'The house is powered by a combination of 10kva inverter, PHCN and (sometimes) generator.',
      details: [
        {
          subtitle: 'Inverter Schedule',
          text: "The inverter (especially during summer period) supports heavy appliance usage (2 ACs, washing machine, iron, electric kettles, microwave, and lights) from around 8.30am to 3pm and support light appliance usage (TV and few lights) from 3.01pm to 7pm. The reduction in load capacity is due to an equivalent reduction in the sun's intensity from 3pm. To use microwave after 3pm, temporarily turn off TV and unused lights.",
          extra: 'During summer period, solar panels charge the inverter from 7.30am/8am, while during raining season, charging usually commences around 9am/9.30am. At both seasons, allow the inverter some time to charge before loading appliances on it. Inverter power is usually at its strongest from midday to 3pm.',
        },
        {
          subtitle: 'PHCN Connection',
          text: 'The house is connected to PHCN. The pre-installed alarm in the gate house notify guests when PHCN is restored. A coloured bulb located in the small corridor to the rooms serves the same purpose – when this bulb is on, the house is operating on government light. Although ACs and other appliances can be used when PHCN is available, kindly note that fair use policy applies especially to AC usage as the apartment runs on pre-paid meter.',
          extra: 'The apartment is located in a BAND C zone; there will therefore be light for a minimum of 12 hours on most days. The bulk of the 12 hours of light is made available over the night.',
        },
        {
          subtitle: 'Generator Usage',
          text: 'A 9kva generator is used to complement inverter and PHCN – usually from 7pm to 11.30pm (most times, PHCN is restored before 11.30pm). Please note that only 1 AC can and should be used with the generator. TV and microwave can also be used, but to use microwave, temporarily switch off AC.',
        },
        {
          subtitle: 'Changeover System',
          text: 'An automatic changeover system is in place. This automates changing of power source between PHCN, generator and inverter. Occasionally check the coloured bulb or listen for the sound alarm to know when the apartment is on government light.',
        },
        {
          subtitle: 'Keeping Cool',
          text: 'There are 4 ACs in the apartment. All 4 work on government light but only 2 work with the inverter – 1 in the living room, 1 in the bedroom with water heater.',
          extra: 'For period when ACs cannot be used, 4 rechargeable fans are available for keeping cool. It is also safe to open the windows if necessary.',
        },
        {
          subtitle: 'Daily Schedule Summary',
          list: [
            'During the day (morning to 3pm) – Inverter (when there is no light)',
            'From 3pm to 7pm – Inverter (but no AC use except government light is available)',
            'From 7pm to 11.30pm – Generator (1 AC can be used)',
            'From 11.30pm to morning – Inverter (no AC use except government light is restored)',
          ],
        },
        {
          subtitle: 'Important Tips for 24/7 Power',
          list: [
            'Use WASHING MACHINE during the day, preferably from 8.30am/9.30am but not later than 3pm. Consider using quick wash option (soft materials) and wool option (thick materials)',
            'IRON clothes during the day (from 8.30/9.30am to 3pm)',
            'DO NOT use the ACs after 3pm (except if PHCN is available)',
            'If you are home throughout the day, consider allowing the AC some resting time',
            'When going to bed, switch off the AC connected to the inverter with the remote',
            'Use the 4 rechargeable fans for ventilation outside the AC use period',
            "Don't switching on/off the bathroom water heater as this is remotely operated around 6am every morning",
          ],
        },
      ],
    },
    {
      title: 'Kitchen',
      category: 'Appliances',
      content: 'There is gas cooker in the kitchen. If you need help using this, let the House Manager know. Gas should be turned off once cooking is completed. If the gas in the connected cylinder finishes, please change to the back-up cylinder.',
      details: [
        { text: 'Electric kettle, toaster, microwave & blender are also in the kitchen. It is recommended that these appliances be used during the day (till 3pm) and when there is light. Microwave can, however, be used after 3pm, but make sure to turn off other TV temporarily.' },
        { text: 'Air fryer should be used with PHCN or, if with inverter, before 3pm. Plates and kitchen utensils are located in the cabinets/centre cabinet.' },
        { text: 'Washing machine is in the kitchen balcony. Locate the switch at the back (see welcome video). Select the washing program that works best for you (quick wash or wool options). Press the start/pause button. Detergent and clips/pegs are inside the unlocked shelf on top of the washing machine. Clothes hanger is stationed in the balcony.' },
      ],
    },
    {
      title: 'Left-Over Frozen Food',
      category: 'Cleanliness',
      content: 'Leftover frozen food items in the fridge/freezer should be cleared out and trashed before check-out.',
    },
    {
      title: 'Cleaning',
      category: 'Maintenance',
      content: "Please keep the apartment in the same clean and presentable state in which it's handed over to you. All used kitchen utensils must therefore be washed. Bathroom floors should be kept in dry condition.",
    },
    {
      title: 'Damage',
      category: 'Responsibility',
      content: 'In the unlikely event that there is a damage to any of the items within the apartment, please make sure to report such damage/breakage in a timely manner. The host reserves their right to seek legal remedy from the booker in respect of such damage.',
    },
    {
      title: 'Before You Check Out',
      category: 'Checkout',
      content: 'Check out time is 12pm. All keys must be returned into the Key Safe by this time. Kindly notify the House Manager upon check-out.',
      details: [
        { subtitle: 'Rubbish', text: 'Please deposit used bin bags inside the bigger bin located around the carport.' },
        { subtitle: 'Turn Things Off', text: 'Confirm all bulbs/lights and appliances have been turned off.' },
        { subtitle: 'Return Keys into the Key Safe', text: 'Check out time is 12pm. All keys must be returned into the Key Safe by this time. Kindly notify the House Manager upon check-out.' },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// SEED
// ---------------------------------------------------------------------------

function bail(context, error) {
  console.error(`\n✖ ${context}:`, error.message || error);
  if ((error.message || '').toLowerCase().includes('does not exist')) {
    console.error('  → It looks like the tables are missing. Run database/01_tables.sql first, then re-run this script.');
  }
  process.exit(1);
}

async function run() {
  console.log('\nSeeding BookAStay content…\n');

  // Page content — insert if missing, OR repair if the stored value is empty/broken.
  //    A real admin edit (non-empty) is preserved; an empty {} left behind by a past
  //    broken/partial SQL run is overwritten with the correct content.
  {
    const targets = [
      { key: 'about', title: 'About Us', value: about, ok: (v) => Array.isArray(v?.paragraphs) && v.paragraphs.length > 0 },
      { key: 'house_rules', title: 'House Rules', value: houseRules, ok: (v) => Array.isArray(v?.rules) && v.rules.length > 0 },
    ];

    const { data: existing, error: readErr } = await supabaseAdmin
      .from('site_content')
      .select('key, value')
      .in('key', targets.map((t) => t.key));
    if (readErr) bail('Reading page content', readErr);
    const byKey = Object.fromEntries((existing || []).map((r) => [r.key, r.value]));

    for (const t of targets) {
      const has = Object.prototype.hasOwnProperty.call(byKey, t.key);
      if (has && t.ok(byKey[t.key])) {
        console.log(`• ${t.key}: already populated — left untouched`);
        continue;
      }
      const { error } = await supabaseAdmin
        .from('site_content')
        .upsert({ key: t.key, title: t.title, value: t.value }, { onConflict: 'key' }); // real upsert: overwrites the empty row
      if (error) bail(`Writing ${t.key}`, error);
      console.log(`✓ ${t.key}: ${has ? 'REPAIRED (was empty/invalid)' : 'inserted'}`);
    }
  }

  console.log('\nDone. About + House Rules are seeded.');
  console.log('Getting Around is intentionally not seeded (see database/05_cleanup.sql).\n');
  process.exit(0);
}

run().catch((err) => bail('Unexpected error', err));
