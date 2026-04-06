export function TermsConditionsSection() {
  return (
    <section className="rounded-3xl border-2 border-amber-400/50 bg-gradient-to-br from-amber-950/30 via-violet-950/20 to-pink-950/25 px-6 py-8 md:px-8">
      <div className="mx-auto max-w-3xl">
        <h2 className="font-display text-3xl text-honey-text">House rules</h2>
        <p className="mt-3 border-t border-amber-400/30 pt-3 font-mono text-xs tracking-wider text-amber-200/80">
          •••••••••••••••••••••••••••••••••••
        </p>

        <div className="mt-6 space-y-3 text-sm text-honey-text">
          <p>By making a purchase, you automatically accept these house rules.</p>
          <p>Ignorance of the rules does not excuse you from abiding by them.</p>
          <p>For serious violations of the rules, the customer&apos;s account will be blocked.</p>
        </div>

        <hr className="my-8 border-honey-border/40" />

        <div className="space-y-8 text-sm text-honey-text">
          <section className="space-y-3">
            <h3 className="font-display text-base text-honey-text">1. Behavior and communication</h3>
            <ol className="list-decimal space-y-2 pl-5 marker:text-amber-300/90">
              <li>
                Disrespectful behavior, threats, insults, provocations, manipulation, and toxic communication are
                prohibited.
              </li>
              <li>Insults directed at the operator or other customers will result in blocking without warning.</li>
              <li>
                We value a friendly atmosphere. Any disputes are resolved exclusively through the operator.
              </li>
            </ol>
          </section>

          <hr className="border-honey-border/30" />

          <section className="space-y-3">
            <h3 className="font-display text-base text-honey-text">2. Placing orders</h3>
            <ol className="list-decimal space-y-2 pl-5 marker:text-amber-300/90">
              <li>
                Any order or question is processed in a single, clear and structured message: product, quantity, and
                delivery preference where relevant.
              </li>
              <li>After sending the message, the customer calmly awaits the operator&apos;s response.</li>
              <li>Spam, flooding, multiple duplicates, and harassing messages are prohibited.</li>
              <li>
                In case of repeated violations, the operator reserves the right to temporarily or permanently block the
                client&apos;s account.
              </li>
            </ol>
          </section>

          <hr className="border-honey-border/30" />

          <section className="space-y-3">
            <h3 className="font-display text-base text-honey-text">3. Payment for orders</h3>
            <ol className="list-decimal space-y-2 pl-5 marker:text-amber-300/90">
              <li>
                Payment for web orders is by bank transfer using the reference and instructions shown after checkout. Other
                payment channels may be offered by the operator when agreed in writing.
              </li>
              <li>Payment is possible only using the details provided by the operator at the time of the transaction.</li>
              <li>Independent transfers to old or third-party details are not accepted.</li>
              <li>Network fees are always paid by the client.</li>
              <li>
                The exchange rate is fixed according to the rules specified by the operator at the time of the transaction
                (the client must read and agree to these rules before paying).
              </li>
            </ol>
          </section>

          <hr className="border-honey-border/30" />

          <section className="space-y-3">
            <h3 className="font-display text-base text-honey-text">4. Order processing timeframes</h3>
            <ol className="list-decimal space-y-2 pl-5 marker:text-amber-300/90">
              <li>
                Any order that is not approved by an admin within 15 minutes is automatically cancelled by the system.
              </li>
              <li>The client must be ready to pay at the time of placing the order.</li>
              <li>After receiving the payment details from the operator, the client can make the payment within 15 minutes.</li>
              <li>If payment is not received on time, the order is automatically canceled.</li>
              <li>Overdue payment documents and screenshots will not be accepted.</li>
            </ol>
          </section>

          <hr className="border-honey-border/30" />

          <section className="space-y-3">
            <h3 className="font-display text-base text-honey-text">5. Client integrity</h3>
            <ol className="list-decimal space-y-2 pl-5 marker:text-amber-300/90">
              <li>
                Any attempts at fraud, deception, or misleading the operator will result in immediate account blocking
                without explanation.
              </li>
              <li>
                Clients with a history of violations are added to a closed list; their applications will not be considered.
              </li>
            </ol>
          </section>

          <hr className="border-honey-border/30" />

          <section className="space-y-3">
            <h3 className="font-display text-base text-honey-text">6. Transfer of purchased locations</h3>
            <ol className="list-decimal space-y-2 pl-5 marker:text-amber-300/90">
              <li>Transferring purchased locations to third parties is strictly prohibited.</li>
              <li>If the material is transferred to a third party, support for resolving disputes will not be provided.</li>
            </ol>
          </section>

          <hr className="border-honey-border/30" />

          <section className="space-y-3">
            <h3 className="font-display text-base text-honey-text">7. Dispute resolution rules</h3>
            <ol className="list-decimal space-y-3 pl-5 marker:text-amber-300/90">
              <li>Complaints will only be considered from the client who directly purchased the location.</li>
              <li>
                If the client reports a problem later than 5 hours after receiving the location, the materials for that
                location are considered successfully found.
              </li>
              <li>
                It is prohibited to discuss issues related to problematic locations outside of the operator chat.
                Violating this clause will result in the client being denied support.
              </li>
              <li>
                <span className="font-medium text-honey-text">If problems with the location arise, the client is obligated to:</span>
                <ul className="mt-2 list-disc space-y-1.5 pl-5 text-honey-muted marker:text-amber-300/70">
                  <li>
                    provide a video recording of the route to the location from at least 50 meters away, as well as a video
                    of the search clearly showing the terrain and the search process;
                  </li>
                  <li>attach 3–4 high-quality photos of the point as it is indicated in the location;</li>
                  <li>if possible, perform this during daylight hours.</li>
                </ul>
              </li>
              <li>
                <span className="font-medium text-honey-text">In the complaint, the client must indicate:</span>
                <ul className="mt-2 list-disc space-y-1.5 pl-5 text-honey-muted marker:text-amber-300/70">
                  <li>whether they conducted the search personally or transferred the location to a third party;</li>
                  <li>what exactly they discovered at the location;</li>
                  <li>
                    whether there are any signs of environmental changes (repairs, cleaning, new obstacles, etc.);
                  </li>
                  <li>how thoroughly they checked the location.</li>
                </ul>
              </li>
              <li>Complaints that do not include at least one of the above points will not be considered.</li>
            </ol>
          </section>

          <hr className="border-honey-border/30" />

          <section className="space-y-3">
            <h3 className="font-display text-base text-honey-text">8. Location replacement</h3>
            <ol className="list-decimal space-y-2 pl-5 marker:text-amber-300/90">
              <li>
                A problematic location can only be replaced if the customer has made at least 10 successful purchases at the
                store.
              </li>
              <li>The team reserves the right to refuse a new location without explanation.</li>
            </ol>
          </section>
        </div>

        <p className="mt-8 text-sm font-medium text-honey-text">
          In case of any issue, feel free to contact support anytime.
        </p>
      </div>
    </section>
  );
}
