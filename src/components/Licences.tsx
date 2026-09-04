/**
 * Open source licences.
 *
 * This exists because of a real obligation, not as a courtesy. Space Grotesk
 * ships as font binaries inside the APK under the SIL Open Font License 1.1,
 * and OFL-1.1 requires its copyright notice and licence to travel with the
 * files. Apache-2.0 (lottie-react-native) has the same expectation via its
 * NOTICE convention, and MIT requires the notice be included in "all copies
 * or substantial portions". None of that was anywhere in the app before.
 *
 * OpenPowerlifting is the odd one out and is listed on purpose: their data is
 * public domain and requires nothing at all, but the percentile numbers are
 * the app's strongest claim and naming the source is what makes them
 * checkable.
 *
 * Keep this list honest. When a dependency with a notice obligation is added,
 * it belongs here on the same commit.
 */
import { ScrollView, View } from "react-native";
import { C } from "../theme";
import { Divider, Eyebrow, Txt } from "./ui";

interface Entry {
  name: string;
  what: string;
  licence: string;
  notice: string;
}

const ENTRIES: Entry[] = [
  {
    name: "Space Grotesk",
    what: "The typeface used throughout the app.",
    licence: "SIL Open Font License 1.1",
    notice:
      "Copyright 2020 The Space Grotesk Project Authors " +
      "(https://github.com/floriankarsten/space-grotesk). This Font Software " +
      "is licensed under the SIL Open Font License, Version 1.1. This licence " +
      "is available with a FAQ at https://openfontlicense.org",
  },
  {
    name: "Tabler Icons",
    what: "Every icon in the interface.",
    licence: "MIT",
    notice:
      "Copyright (c) 2020-2026 Paweł Kuna. Permission is hereby granted, free " +
      "of charge, to any person obtaining a copy of this software and " +
      "associated documentation files, to deal in the Software without " +
      "restriction. The software is provided \"as is\", without warranty of " +
      "any kind.",
  },
  {
    name: "lottie-react-native",
    what: "Plays the streak animation.",
    licence: "Apache License 2.0",
    notice:
      "Copyright (c) Airbnb, Inc. Licensed under the Apache License, " +
      "Version 2.0. You may obtain a copy of the licence at " +
      "http://www.apache.org/licenses/LICENSE-2.0",
  },
  {
    name: "React Native and Expo",
    what: "The framework the app is built on.",
    licence: "MIT",
    notice:
      "Copyright (c) Meta Platforms, Inc. and affiliates. " +
      "Copyright (c) 2015-present 650 Industries, Inc. (aka Expo). " +
      "Both licensed under the MIT License.",
  },
  {
    name: "OpenPowerlifting",
    what:
      "The competition results behind every percentile. Nothing is required " +
      "of us here, the data is public domain, but the source is worth naming.",
    licence: "Public domain (CC0)",
    notice:
      "Percentiles are computed from the OpenPowerlifting project's data " +
      "export of 2026-08-08, filtered to raw lifts, best result per lifter. " +
      "See https://openpowerlifting.org",
  },
];

export function Licences() {
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40, gap: 4 }}>
      <Txt size={12} color={C.inkSoft} style={{ marginBottom: 8 }}>
        torq is built on other people's work. These are the parts that are not
        ours, and the terms they come under.
      </Txt>
      {ENTRIES.map((e, i) => (
        <View key={e.name}>
          {i > 0 ? <Divider /> : null}
          <View style={{ gap: 3, paddingVertical: 12 }}>
            <Txt size={13.5} weight="bold">{e.name}</Txt>
            <Txt size={11.5} color={C.inkSoft}>{e.what}</Txt>
            <Eyebrow>{e.licence}</Eyebrow>
            <Txt size={11} color={C.inkFaint} style={{ lineHeight: 16 }}>
              {e.notice}
            </Txt>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
