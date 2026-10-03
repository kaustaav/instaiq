package com.influenceiq.crm.influencer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** Plain unit test: no Spring, no database, runs in milliseconds. */
class InstagramHandleTest {

    @ParameterizedTest // one test, run once per input
    @ValueSource(strings = {
            "priyajewels", "@PriyaJewels", "  priyajewels  ",
            "https://www.instagram.com/PriyaJewels/", "http://instagram.com/priyajewels?igsh=abc",
            "instagram.com/priyajewels", "www.instagram.com/PriyaJewels/"})
    void normalizesWhatPeoplePaste(String raw) {
        // regression: "instagram.com/priyajewels" (no https://) used to become the bogus handle "instagram.com"
        assertThat(InstagramHandle.parse(raw).value()).isEqualTo("priyajewels");
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "   ", "has space", "émoji", "way_too_long_handle_more_than_30_chars", "semi;colon"})
    void rejectsInvalidHandles(String raw) {
        assertThatThrownBy(() -> InstagramHandle.parse(raw)).isInstanceOf(IllegalArgumentException.class);
    }

    @ParameterizedTest
    @ValueSource(strings = {"PriyaJewels", "@priyajewels"})
    void constructorOnlyAcceptsAlreadyNormalizedValues(String raw) {
        // new InstagramHandle(...) is strict; parse(...) is the friendly entry point
        assertThatThrownBy(() -> new InstagramHandle(raw)).isInstanceOf(IllegalArgumentException.class);
    }

    @org.junit.jupiter.api.Test
    void valueObjectsWithTheSameValueAreEqual() {
        assertThat(InstagramHandle.parse("@PriyaJewels")).isEqualTo(new InstagramHandle("priyajewels"));
        assertThat(new InstagramHandle("priyajewels").profileUrl()).isEqualTo("https://www.instagram.com/priyajewels/");
    }
}
