import Button from "@cire/ui/button";
import { createMemo, createSignal, createUniqueId, For, Show } from "solid-js";

import { DemoModal } from "./DemoModal";

// A self-contained, no-backend preview of a Cire invitation. Everything is
// interactive — you can pick events, toggle attendance, type a dietary note and
// "send" — but the RSVP is a deliberate NO-OP: nothing leaves the browser. This
// mirrors the real guest flow closely enough to feel live while making clear it
// is a demonstration. The same no-op treatment is used for the organiser host
// preview in cire/invites.

interface DemoMember {
  guestId: string;
  firstName: string;
  lastName: string;
  eventIds: string[];
}

interface DemoEvent {
  id: string;
  name: string;
  date: string;
  location: string;
  description: string;
}

const DEMO_EVENTS: DemoEvent[] = [
  {
    id: "ceremony",
    name: "The Ceremony",
    date: "Saturday, 17 October 2026",
    location: "Cliffside Chapel, Byron Bay",
    description: "Vows at golden hour, followed by canapés on the lawn.",
  },
  {
    id: "reception",
    name: "The Reception",
    date: "Saturday, 17 October 2026",
    location: "The Glasshouse, Byron Bay",
    description: "Dinner, dancing and a little late-night magic.",
  },
];

const DEMO_MEMBERS: DemoMember[] = [
  {
    guestId: "g-amara",
    firstName: "Amara",
    lastName: "Reyes",
    eventIds: ["ceremony", "reception"],
  },
  { guestId: "g-sam", firstName: "Sam", lastName: "Reyes", eventIds: ["ceremony", "reception"] },
];

type Attending = "attending" | "declined" | null;

export function DemoRsvp() {
  const [rsvpEvent, setRsvpEvent] = createSignal<DemoEvent | null>(null);

  return (
    <div class="border-border bg-surface-raised mx-auto max-w-[640px] overflow-hidden rounded-lg border shadow-2xl">
      {/* An honest frame header — a plain label, not imitation browser chrome. */}
      <div class="border-border flex items-center justify-center border-b px-4 py-3">
        <span class="font-body text-text-muted text-osn-xs tracking-osn-widest uppercase">
          A live Cire invitation
        </span>
      </div>

      <div class="px-6 py-10 text-center md:px-10">
        <p class="font-body text-gold text-osn-xs tracking-osn-ultra mb-3 uppercase">
          Together with their families
        </p>
        <h3 class="font-display text-text leading-osn-none mb-2 text-[clamp(2rem,6vw,2.75rem)] font-light italic">
          Amara &amp; Sam
        </h3>
        <p class="font-body text-text-muted text-osn-base mb-8 font-light">
          request the pleasure of your company
        </p>

        <div class="flex flex-col gap-4 text-left">
          <For each={DEMO_EVENTS}>
            {(event) => (
              <article class="border-border bg-surface rounded-sm border px-5 py-5">
                <h4 class="font-display text-text mb-1 text-xl font-normal italic">{event.name}</h4>
                <p class="font-body text-gold text-osn-xs tracking-osn-wider mb-1 uppercase">
                  {event.date}
                </p>
                <p class="font-body text-text-muted text-osn-sm mb-2">{event.location}</p>
                <p class="font-body text-text-muted text-osn-sm leading-osn-normal mb-4 font-light">
                  {event.description}
                </p>
                <Button variant="cta" class="min-h-11" onClick={() => setRsvpEvent(event)}>
                  Respond
                </Button>
              </article>
            )}
          </For>
        </div>

        <p class="font-body text-text-muted text-osn-xs tracking-osn-wide mt-6">
          This is an interactive preview. Responses aren&rsquo;t saved.
        </p>
      </div>

      <Show when={rsvpEvent()}>
        {(event) => (
          <DemoRsvpModal
            event={event()}
            members={DEMO_MEMBERS}
            onClose={() => setRsvpEvent(null)}
          />
        )}
      </Show>
    </div>
  );
}

interface DemoRsvpModalProps {
  event: DemoEvent;
  members: DemoMember[];
  onClose: () => void;
}

interface MemberState {
  attending: Attending;
  dietary: string;
}

function DemoRsvpModal(props: DemoRsvpModalProps) {
  const eventMembers = createMemo(() =>
    props.members.filter((m) => m.eventIds.includes(props.event.id)),
  );

  const [responses, setResponses] = createSignal<Record<string, MemberState>>(
    Object.fromEntries(
      eventMembers().map((m) => [m.guestId, { attending: null, dietary: "" } as MemberState]),
    ),
  );
  const [error, setError] = createSignal<string | null>(null);
  const [submitted, setSubmitted] = createSignal(false);
  const titleId = createUniqueId();

  function setAttending(guestId: string, attending: Attending) {
    setResponses((prev) => ({ ...prev, [guestId]: { ...prev[guestId]!, attending } }));
  }
  function setDietary(guestId: string, dietary: string) {
    setResponses((prev) => ({ ...prev, [guestId]: { ...prev[guestId]!, dietary } }));
  }

  function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    setError(null);
    const current = responses();
    const allAnswered = eventMembers().every((m) => current[m.guestId]?.attending !== null);
    if (!allAnswered) {
      setError("Please respond for everyone in your party.");
      return;
    }
    // The deliberate no-op: a real invite would POST here. The demo just confirms.
    setSubmitted(true);
  }

  return (
    <DemoModal onClose={props.onClose} labelledBy={titleId}>
      <Show
        when={!submitted()}
        fallback={
          <div class="py-6 text-center">
            <p class="font-body text-gold text-osn-xs tracking-osn-widest mb-3 uppercase">
              Preview
            </p>
            <h3 class="font-display text-text text-osn-xl mb-4 font-light italic">
              That&rsquo;s the feeling.
            </h3>
            <p class="font-body text-text-muted text-osn-base leading-osn-normal mb-7 font-light">
              On a real Cire invitation, your reply would be on its way to the couple and counted in
              their live guest dashboard. Here, nothing is saved. It&rsquo;s just a taste.
            </p>
            <Button variant="cta" size="lg" onClick={() => props.onClose()}>
              Close
            </Button>
          </div>
        }
      >
        <p class="font-body text-gold text-osn-xs tracking-osn-widest mb-3 uppercase">Respond</p>
        <h3 id={titleId} class="font-display text-text text-osn-xl mb-2 font-light italic">
          {props.event.name}
        </h3>
        <p
          class="border-gold/40 bg-gold/5 text-gold text-osn-xs mb-6 rounded-sm border px-3.5 py-2.5 leading-relaxed"
          role="status"
        >
          Interactive preview. Your reply won&rsquo;t be saved.
        </p>

        <form class="flex flex-col gap-5" onSubmit={handleSubmit}>
          <For each={eventMembers()}>
            {(member) => {
              const guestId = member.guestId;
              return (
                <fieldset class="border-border m-0 rounded-sm border p-5">
                  <legend class="font-display text-text text-osn-md mb-3 font-normal italic">
                    {member.firstName} {member.lastName}
                  </legend>
                  <div class="flex gap-2">
                    <button
                      type="button"
                      class="font-body text-osn-sm tracking-osn-wide flex-1 cursor-pointer rounded-sm border px-3 py-2.5 uppercase transition-colors duration-200"
                      classList={{
                        "border-gold text-gold bg-gold/8":
                          responses()[guestId]?.attending === "attending",
                        "border-border text-text-muted hover:border-gold-dim hover:text-text":
                          responses()[guestId]?.attending !== "attending",
                      }}
                      aria-pressed={responses()[guestId]?.attending === "attending"}
                      onClick={() => setAttending(guestId, "attending")}
                    >
                      Attending
                    </button>
                    <button
                      type="button"
                      class="font-body text-osn-sm tracking-osn-wide flex-1 cursor-pointer rounded-sm border px-3 py-2.5 uppercase transition-colors duration-200"
                      classList={{
                        "border-gold text-gold bg-gold/8":
                          responses()[guestId]?.attending === "declined",
                        "border-border text-text-muted hover:border-gold-dim hover:text-text":
                          responses()[guestId]?.attending !== "declined",
                      }}
                      aria-pressed={responses()[guestId]?.attending === "declined"}
                      onClick={() => setAttending(guestId, "declined")}
                    >
                      Not attending
                    </button>
                  </div>
                  <Show when={responses()[guestId]?.attending === "attending"}>
                    <label class="font-body text-text-muted text-osn-sm tracking-osn-wide mt-3 block uppercase">
                      Dietary requirements
                      <input
                        type="text"
                        class="border-border font-body text-text placeholder:text-text-muted focus:border-gold sm:text-osn-base mt-1.5 block w-full rounded-sm border bg-transparent px-3 py-2.5 text-base transition-colors duration-200 focus:outline-none"
                        placeholder="e.g. Vegetarian, no nuts"
                        value={responses()[guestId]?.dietary ?? ""}
                        onInput={(e) => setDietary(guestId, e.currentTarget.value)}
                        maxLength={200}
                      />
                    </label>
                  </Show>
                </fieldset>
              );
            }}
          </For>

          <Show when={error()}>
            <p class="font-body text-error text-osn-sm py-1" role="alert">
              {error()}
            </p>
          </Show>

          <div class="border-border bg-surface sticky bottom-0 -mx-6 -mb-[max(2.5rem,env(safe-area-inset-bottom))] flex gap-3 border-t px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:-mb-10 md:pb-4">
            <Button variant="quiet" class="flex-1" onClick={() => props.onClose()}>
              Cancel
            </Button>
            <Button type="submit" variant="cta" class="flex-1">
              Send RSVP
            </Button>
          </div>
        </form>
      </Show>
    </DemoModal>
  );
}
