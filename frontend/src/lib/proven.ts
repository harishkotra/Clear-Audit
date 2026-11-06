/** Live v3 seed + historical v2 proofs. /evidence filters by dealId on the live vault. */
export const PROVEN = [
  {
    what: "Named 5 USDC bounty with acceptance criteria (v3, Open)",
    dealId: "0",
    createTx: "0x2bacbe4dfb881b00327d56cd40a64df0213162edb4be412d18174ccbe74545c8",
  },
  {
    what: "The gate refuses when no anchor exists",
    dealId: "1",
    createTx: "0xbdb88842c817e4355e0810aa9c99a8f7666b54bdc70a9df8aeac9fd12e69478b",
    guard: "POST /api/release-guard returned 403, no live Arkiv anchor",
  },
  {
    what: "Open task, unclaimed, 2-hour deadline",
    dealId: "2",
    createTx: "0xb80b8f09e33ed286302dfc1144d9de9e840a908ce54102fce30871756bf58a19",
  },
  {
    what: "v3 evidence loop: Arkiv anchor + commitEvidence, canSettle true",
    dealId: "3",
    createTx: "0x54db3731ead9498e4cca3a86f8375175220f59fb6cf1cf6ef43ef217c781bbb2",
    anchorKey: "0x827496e1cd7c13af37b2c830b53409fb9909755e5c3960a69ded4aad3db900b7",
    anchorTx: "0x739c8298a3c7a6ee400b06fc4cd1f5f80a046997cad5e5f7da78cf151dbf2f7f",
    result: "commitEvidence tx 0x5dfbd6b5…f7a6, canSettle(3)=true, deal left Open for the booth",
  },
] as const;

export const ZERO_BYTES32 = `0x${"00".repeat(32)}`;
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
