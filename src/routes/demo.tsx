import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Share your feedback — Demo" },
      {
        name: "description",
        content:
          "A short 4-question feedback form. Tell us what's working and what we can improve.",
      },
      { property: "og:title", content: "Share your feedback — Demo" },
      {
        property: "og:description",
        content:
          "A short 4-question feedback form. Tell us what's working and what we can improve.",
      },
    ],
  }),
  component: DemoPage,
});

const feedbackSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(80, "Keep it under 80 characters"),
  rating: z.enum(["1", "2", "3", "4", "5"], {
    message: "Pick a rating from 1 to 5",
  }),
  feature: z.enum(["editor", "insights", "workflows", "other"], {
    message: "Select the feature you use most",
  }),
  comments: z.string().trim().max(500, "Keep it under 500 characters").optional(),
});

type FeedbackValues = z.infer<typeof feedbackSchema>;

function DemoPage() {
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<FeedbackValues>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: { name: "", comments: "" },
  });

  function onSubmit(_values: FeedbackValues) {
    // Intentionally not persisted anywhere.
    setSubmitted(true);
  }

  function reset() {
    form.reset({ name: "", comments: "", rating: undefined, feature: undefined });
    setSubmitted(false);
  }

  return (
    <div className="min-h-screen bg-surface text-ink">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2 text-sm text-ink/70 hover:text-ink">
          <ArrowLeft className="size-4" />
          Back to home
        </Link>
        <span className="text-xs uppercase tracking-widest text-ink/50">Demo</span>
      </header>

      <main className="mx-auto max-w-2xl px-6 pb-24 pt-8">
        <div className="rounded-3xl border border-ink/10 bg-white p-8 shadow-sm sm:p-10">
          {submitted ? (
            <div className="flex flex-col items-center text-center">
              <div className="mb-5 flex size-14 items-center justify-center rounded-full bg-brand/10">
                <CheckCircle2 className="size-7 text-brand" strokeWidth={2} />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">Thanks for your feedback!</h1>
              <p className="mt-2 max-w-sm text-sm text-ink/60">
                We appreciate you taking a moment. Your responses are not stored — this is a demo
                form.
              </p>
              <div className="mt-8 flex gap-3">
                <Button variant="outline" onClick={reset}>
                  Submit another response
                </Button>
                <Button asChild>
                  <Link to="/">Back to home</Link>
                </Button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">Share your feedback</h1>
              <p className="mt-2 text-sm text-ink/60">
                Four quick questions. Takes under a minute.
              </p>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 space-y-7">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Your name</FormLabel>
                        <FormControl>
                          <Input placeholder="Jane Doe" maxLength={80} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="rating"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>How would you rate your experience?</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="flex gap-2"
                          >
                            {["1", "2", "3", "4", "5"].map((v) => (
                              <Label
                                key={v}
                                htmlFor={`rating-${v}`}
                                className="flex flex-1 cursor-pointer items-center justify-center rounded-xl border border-ink/10 bg-white py-3 text-sm font-medium transition hover:border-brand/40 has-[[data-state=checked]]:border-brand has-[[data-state=checked]]:bg-brand/5 has-[[data-state=checked]]:text-brand"
                              >
                                <RadioGroupItem value={v} id={`rating-${v}`} className="sr-only" />
                                {v}
                              </Label>
                            ))}
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="feature"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Which feature do you use most?</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Pick one" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="editor">Editor</SelectItem>
                            <SelectItem value="insights">Insights</SelectItem>
                            <SelectItem value="workflows">Workflows</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="comments"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Anything else? (optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="What's working, what isn't…"
                            rows={4}
                            maxLength={500}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full bg-brand text-brand-foreground hover:bg-brand/90"
                  >
                    Submit feedback
                  </Button>
                </form>
              </Form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
