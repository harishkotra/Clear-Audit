/** Live v4 workspace seed. /evidence filters by dealId on the live vault. */
export type Proven = {
  what: string;
  dealId: string;
  createTx: string;
  anchorKey?: string;
  anchorTx?: string;
  releaseTx?: string;
  guard?: string;
  result?: string;
};

export const PROVEN: Proven[] = [
  {
    what: "Post-exploit recovery settlement (Open, evidence committed)",
    dealId: "0",
    createTx: "0xf3608f319e7e159719ab6da268b4337d2ad664082aa597cb8e64ff71ce0f5468",
    anchorKey: "0x0603c34c5036d2f35a51a39f42c0d731dbe2677f55692ed736a5e6ada775ea04",
    anchorTx: "0x52208ce2075f20ad1d71ab65cb3cc084153443b70ea6797716fa746e29636267",
    result: "commitEvidence 0x76f42ac0…4227, left Open for a live release",
  },
  {
    what: "CVD / PSIRT disclosure payout (Open, evidence committed)",
    dealId: "1",
    createTx: "0x1f1c52b141ed9ba62f12fef7dc76a722194de551a956a069564ca352e036b135",
    anchorKey: "0xe887a034c9bcae2dc695322b0f68d9afff6cc42b0fe4e254127977bf95f9c4fc",
    anchorTx: "0x142ecd7ce1ba1782d30693d5a937ebcd63629cec1bb7a8b6fa9592a91586749d",
  },
  {
    what: "Retainer milestone against a threat-model artefact hash",
    dealId: "2",
    createTx: "0xa1ab5d71e303434ea1a420399713a284d64c0900720131993a25e1d4c43fe027",
    anchorKey: "0xc3fc815dee1a4a4e272685f2d960723d2d040db0cadd51203cc862467087e686",
    anchorTx: "0x35b8600d0c33bba1b3a883369137e5ab02369b747bea026660e812621c36cdaa",
  },
  {
    what: "Agent dispatch: ClearAudit operated as the paid agent, not as a fee",
    dealId: "3",
    createTx: "0x348fadb44982578ab82512dcddd449e20408f02def302bc7a605321894931438",
    anchorKey: "0xcb3c7a10e682028b6331d602494cd3fef1718dd051f3d40dafd3a727e12bef52",
    result:
      "operator anchored the deliverable sha256, commitEvidence 0xab60fa11…0987, release 0xb19ae3fe…2fd1 paid 0.20 USDC",
  },
  {
    what: "Audit contest awarded 0.20 + 0.10 USDC to two registered entrants",
    dealId: "4",
    createTx: "0xc983cd65fa6327ee6ae721e0234135b16ff871af3eae983ca71bc2bfe73e9df5",
    result: "award tx 0x79f8ae07…1204, status Released",
  },
];

export const ZERO_BYTES32 = `0x${"00".repeat(32)}`;
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
