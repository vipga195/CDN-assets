using System.Collections.Concurrent;
using System.Threading.Channels;

public sealed class UserEvents
{
    const int MaxPerUser = 5;

    // All access to Map/Closed happens under lock (entry).
    sealed class UserSubs
    {
        public readonly Dictionary<Guid, Channel<string>> Map = new();
        public bool Closed;
    }

    readonly ConcurrentDictionary<long, UserSubs> subs = new();

    public (Guid id, ChannelReader<string> reader)? Subscribe(long uid)
    {
        while (true)
        {
            var entry = subs.GetOrAdd(uid, _ => new UserSubs());
            lock (entry)
            {
                if (entry.Closed) continue; // entry was removed concurrently, retry with a fresh one
                if (entry.Map.Count >= MaxPerUser) return null;
                var ch = Channel.CreateBounded<string>(
                    new BoundedChannelOptions(16) { FullMode = BoundedChannelFullMode.DropOldest });
                var id = Guid.NewGuid();
                entry.Map[id] = ch;
                return (id, ch.Reader);
            }
        }
    }

    public void Unsubscribe(long uid, Guid id)
    {
        if (!subs.TryGetValue(uid, out var entry)) return;
        lock (entry)
        {
            entry.Map.Remove(id);
            if (entry.Map.Count == 0)
            {
                entry.Closed = true;
                // Remove only this exact entry, never a newer one for the same user.
                ((ICollection<KeyValuePair<long, UserSubs>>)subs).Remove(new(uid, entry));
            }
        }
    }

    public void Publish(long uid, string evt)
    {
        if (!subs.TryGetValue(uid, out var entry)) return;
        List<Channel<string>> snapshot;
        lock (entry) snapshot = entry.Map.Values.ToList();
        foreach (var ch in snapshot) ch.Writer.TryWrite(evt);
    }

    // Ends every open stream of the user (used after disabling).
    public void Close(long uid)
    {
        if (!subs.TryRemove(uid, out var entry)) return;
        lock (entry)
        {
            entry.Closed = true;
            foreach (var ch in entry.Map.Values) ch.Writer.TryComplete();
        }
    }
}
