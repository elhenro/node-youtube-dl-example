const youtubedl = require('youtube-dl')
const fs = require('fs')

const url = process.argv[2]
console.log({ url })

async function init () {
  await ingestVideoList({
    url,
    limit: 3,
    filters: {
      maxDurationMinutes: 60,
      titleMustNotInclude: ['LIVE'],
    }
  })
}

async function ingestVideoList ({ url, limit, filters }) {
  const metadataList = await getPlaylistData({ url, limit })
  console.log(`processing ${metadataList.length} videos`)
  for (const metadata of metadataList) {
    await processVideo({ metadata, filters })
  }
}

function getPlaylistData ({ url, limit = 5 }) {
  return new Promise((resolve, reject) => {
    youtubedl.exec(url, ['--dump-json', `--playlist-end=${limit}`], {}, (err, output) => {
      if (err) {
        reject(err)
      }
      resolve(output.map(o => JSON.parse(o)))
    })
  })
}

async function processVideo ({ metadata, filters }) {
  try {
    console.log(`process: "${metadata.title}" - ${metadata.upload_date}`)
    const { maxDurationMinutes, titleMustNotInclude } = filters
    if ((metadata.duration / 60) >= maxDurationMinutes) {
      console.log(`SKIP video duration ${parseFloat(metadata.duration / 60).toPrecision(3)} is longer than max: ${maxDurationMinutes}`)
      return
    }
    const disallowedTerms = titleMustNotInclude.map(disallowedTerm => metadata.title.toLowerCase().match(disallowedTerm.toLowerCase())).filter(a => a)
    if (disallowedTerms.length > 0) {
      console.log('SKIP video title contains disallowed term: ', disallowedTerms)
      return
    }
    await Promise.all([
      new Promise ((resolve, reject) => {
        try {
          const video = youtubedl(metadata.webpage_url, [], { cwd: __dirname })
          video.on('info', async info => {
            console.log('Download started')
            console.log('filename: ' + info._filename)
            console.log('size: ' + info.size)
            const downloadSteam = video.pipe(fs.createWriteStream(info._filename))
            downloadSteam.on('close', () => {
              console.log(`finished downloading ${info._filename}`)
              resolve()
            })
          })
        } catch (err) {
          console.error(err.stack)
          reject(err)
        }
      })
    ])
  } catch (err) {
    console.error(err)
  }
}
;(async () => {
  await init()
})()
