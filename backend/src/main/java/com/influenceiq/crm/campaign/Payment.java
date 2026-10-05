package com.influenceiq.crm.campaign;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** One payment to a member (table "campaign_payment"). Append-only: never edited, never deleted. */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "campaign_payment")
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Getter(AccessLevel.NONE)
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "member_id", nullable = false, updatable = false)
    private CampaignMember member;

    @Column(name = "amount_inr", nullable = false, updatable = false)
    private int amountInr;
    @Column(name = "paid_at", nullable = false, updatable = false)
    private LocalDate paidAt;
    @Column(name = "receipt_url", nullable = false, updatable = false)
    private String receiptUrl;
    @Column(name = "recorded_at", nullable = false, updatable = false)
    private Instant recordedAt;
    @Column(name = "recorded_by", nullable = false, updatable = false)
    private String recordedBy;

    Payment(CampaignMember member, int amountInr, LocalDate paidAt, String receiptUrl, String actor) {
        this.member = member;
        this.amountInr = amountInr;
        this.paidAt = paidAt;
        this.receiptUrl = receiptUrl;
        this.recordedAt = Instant.now();
        this.recordedBy = actor;
    }
}
