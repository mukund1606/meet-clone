"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

import { useLocalStorage } from "@mantine/hooks";
import { useRouter } from "next/navigation";

const RoomFormSchema = z.object({
  roomID: z.string().min(1, { message: "Room ID is required" }),
  name: z.string().min(1, { message: "Name is required" }),
});

export default function RoomForm() {
  const router = useRouter();
  const [name, setName] = useLocalStorage<string>({
    key: "name",
    defaultValue: "Guest",
  });

  const form = useForm<z.infer<typeof RoomFormSchema>>({
    resolver: zodResolver(RoomFormSchema),
    defaultValues: {
      roomID: "",
      name: name,
    },
  });

  function onSubmit(data: z.infer<typeof RoomFormSchema>) {
    setName(data.name);
    router.push(`/room/${data.roomID}`);
  }

  return (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Enter Room</CardTitle>
      </CardHeader>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          <CardContent>
            <FormField
              control={form.control}
              name="roomID"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Room ID</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter Room ID" {...field} />
                  </FormControl>
                  <FormDescription>This is Room ID</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter your name" {...field} />
                  </FormControl>
                  <FormDescription>This is your display name.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="ml-auto">
            <Button type="submit">Submit</Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
