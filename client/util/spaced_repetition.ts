type TMilliseconds = number;

type TDayNumber = number;

export interface ISpacedRepetitionCard {
  id: string;
}

export interface ISpacedRepetitionReview {
  /**
   * Id of the card this review belongs to
   */
  cardId: string;

  /**
   * Timestamp of the review in milliseconds
   */
  timestamp: TMilliseconds;

  /**
   * difficult from 0 to 5.
   * 5 - perfect response
   * 4 - correct response after a hesitation (max 1 stroke mess up)
   * 3 - correct response recalled with serious difficulty (more than 25%)
   * 2 - incorrect response; where the correct one seemed easy to recall (more than 50%)
   * 1 - incorrect response; the correct one remembered (more than 75% messed up)
   * 0 - complete blackout.
   */
  difficulty: number;
}

export type SpacedRepetitionOptions = {
  /**
   * Should return a date to be used as right now. Default date uses UTC.
   */
  nowFn?: () => TMilliseconds;

  /**
   * Enable debug logs
   */
  debug?: boolean;
};

export const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export class SpacedRepetition {
  private options: SpacedRepetitionOptions;

  constructor(options: SpacedRepetitionOptions = {}) {
    this.options = { ...options };
  }

  /** Gets the day number. */
  private getDay(forDate?: TMilliseconds): TDayNumber {
    let millis: number = forDate ?? Date.now();

    if (this.options.nowFn !== undefined) {
      millis = this.options.nowFn();
    }

    return Math.floor(millis / DAY_IN_MILLISECONDS);
  }

  /** Gets the next day this review will have to be reviewed. */
  private computeNextRepetition(reviews: ISpacedRepetitionReview[]): TDayNumber {
    // If there are no reviews make the next day be yesterday. It has to be reviewed now.
    if (reviews.length === 0) {
      return this.getDay() - 1;
    }

    const lastReview = reviews[reviews.length - 1] as ISpacedRepetitionReview;
    const lastReviewDay = this.getDay(lastReview.timestamp);

    if (lastReview.difficulty >= 3) {
      if (reviews.length === 1) {
        return lastReviewDay + 1;
      }

      if (reviews.length === 2) {
        return lastReviewDay + 6;
      }

      let efactor = 2.5;

      reviews.forEach((review) => {
        efactor += +(0.1 - (5 - review.difficulty) * (0.08 + (5 - review.difficulty) * 0.02));
      });

      if (efactor < 1.3) {
        efactor = 1.3;
      }

      return lastReviewDay + Math.ceil(reviews.length * efactor);
    }

    return lastReviewDay;
  }

  /**
   * Get all cards that need to be reviewed.
   * @param cards all possible reviewable cards
   * @param reviews all reviews
   * @returns the tuple of card and when it should've been reviewed
   */
  getDueCards(
    cards: ISpacedRepetitionCard[],
    reviews: ISpacedRepetitionReview[]
  ): [ISpacedRepetitionCard, TDayNumber][] {
    const today = this.getDay();
    console.log("getDueCards today:", today);

    return cards
      .map((card): [ISpacedRepetitionCard, TDayNumber] => {
        const reviewsForCard = reviews.filter((candidate) => {
          return candidate.cardId === card.id;
        });

        return [card, this.computeNextRepetition(reviewsForCard)];
      })
      .filter(([, nextRepetition]) => {
        console.log("filter: ", nextRepetition, " rep: ", nextRepetition <= today);
        return nextRepetition <= today;
      });
  }
}
