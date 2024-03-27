# Podsphere
Podsphere is a persistent data store, a graph-visualized discovery service and a discussion platform for Podcasts, built on `Arweave`.

### Current version: v0.1 (alpha)
Podsphere still resides in a prototype stage. It has not been maintained since the end of 2022.
The latest version of the code can be found right here, on the [development](https://github.com/Davdxv/Podsphere/tree/development) branch.

The current version supports **incremental uploading & fetching of Podcast metadata from RSS feeds to Arweave**.
You can test this on a `locally-run testnet` using the `arlocal` package.
Simply clone the repo & run:

```
npm i; npm run startlocal
```

To use the actual `Arweave mainnet` instead, install the `ArConnect` browser extension and run:

```
npm i; npm run start
```

`NOTE`: In order to fetch certain RSS feeds you will need a working [CORS-Proxy](https://cors-anywhere.herokuapp.com/corsdemo) (this one is used by default; configurable on the Settings page of the app).

### Screenshots
# ![Main app](https://github.com/Davdxv/Podsphere/assets/110099984/c3755212-c384-45c7-a8b7-c500651617c3)

# ![Podcast episodes list](https://github.com/Davdxv/Podsphere/assets/110099984/83511815-5e8d-4dd9-bb75-06f300b05f7a)


### Motivation
Podsphere aims to flourish into a fully-decentralized (Web3) `Podcast metaverse`, sprouting from an ever-growing library of metadata and discussions surrounding podcasts.

Each user plays a vital role in this, by choosing which new pieces of data to contribute.  
This is achieved organically, through mere use of any of the `planned features`:

- Index podcast metadata from RSS feeds and other Web2 or Web3 sources (automated, user-authorized)
- Expand ported metadata with custom user additions (Web3-hosted, Web2-compatible)
- Discover new podcasts by exploring a graph visualization, centered around your subscribed feeds
  - User-customized metadata can promote visibility of otherwise-obscured, related podcasts
- Catalogue your favorite podcast moments
  - Choose which ones to put up for public discussion and which ones to keep as private heirlooms

The goal is not just to provide a platform uniting these features, but to provide `permanent archival of all corresponding data`.  
The `Arweave blockchain` facilitates this, conceivably for centuries to come.
