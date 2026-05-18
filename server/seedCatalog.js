const ADJ = ['Neo-crystal', 'Velvet noir', 'Architectural satin', 'Liquid-metal', 'Opera-lit', 'Sculpted silk']

const ROOM = [
  'stairwell',
  'atrium',
  'rooftop',
  'museum wing',
  'afterparty',
  'archive hall',
  'opera foyer',
  'courtyard light',
]

const TAILOR = ['Heat-molded', 'Hand-beaded', 'Laser-cut', 'Suspended', 'Feather-light']

const PALETTE = [
  'duochrome jewel',
  'metallic dusk',
  'alabaster chrome',
  'neon graphite',
  'nocturnal gold',
  'aurora noir',
  'prismatic smoke',
]

const STARTER_ROWS = [
  {
    id: 'mg-liquid-silver',
    title: 'Liquid Silver Sculpture',
    description: 'Architectural tailoring with mirrored pleats and halo lighting.',
    image_url:
      'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=780&q=80',
    sort_order: 1,
  },
  {
    id: 'mg-velvet-night',
    title: 'Velvet After Midnight',
    description: 'Floor-length noir velvet, opera gloves, and a single sapphire pin.',
    image_url:
      'https://images.unsplash.com/photo-1541099649105-f69ad21a324d?auto=format&fit=crop&w=780&q=80',
    sort_order: 2,
  },
  {
    id: 'mg-couture-chartreuse',
    title: 'Couture Chartreuse',
    description: 'Sculptural ruffles engineered to catch every step down the staircase.',
    image_url:
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=780&q=80',
    sort_order: 3,
  },
]

function arcTitle(gs) {
  return `${ADJ[gs % ADJ.length]} ${ROOM[gs % ROOM.length]} study`
}

function arcDescription(gs) {
  const tailor = TAILOR[gs % TAILOR.length]
  const palette = PALETTE[gs % PALETTE.length]

  return `${tailor} tailoring honoring ${palette} lighting with pleat choreography #${gs} and hand-finished edging.`
}

function arcRow(gs) {
  const padded = String(gs).padStart(3, '0')

  return {
    id: `mg-arc-${padded}`,
    title: arcTitle(gs),
    description: arcDescription(gs),
    image_url: `https://picsum.photos/seed/galaswipe-${padded}/780/1040`,
    sort_order: gs,
  }
}

export function seedCatalogIfEmpty(db) {
  const { c } = db.prepare('SELECT COUNT(*) AS c FROM items').get()

  if (c > 0) {
    return
  }

  const insert = db.prepare(`
    INSERT INTO items (id, title, description, image_url, sort_order)
    VALUES (@id, @title, @description, @image_url, @sort_order)
  `)

  db.exec('BEGIN IMMEDIATE')
  try {
    for (const row of STARTER_ROWS) {
      insert.run(row)
    }

    for (let gs = 4; gs <= 100; gs += 1) {
      insert.run(arcRow(gs))
    }

    db.exec('COMMIT')
  } catch (err) {
    try {
      db.exec('ROLLBACK')
    } catch {
      /* ignore rollback errors */
    }
    throw err
  }
}
