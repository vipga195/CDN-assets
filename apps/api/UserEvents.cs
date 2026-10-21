using System.Collections.Concurrent;
using System.Threading.Channels;

public sealed class UserEvents
{
    const int MaxPerUser = 5;
    readonly ConcurrentDictionary<long, ConcurrentDictionary<Guid, Channel<string>>> subs = new();

    public (Guid id, ChannelReader<string> reader)? Subscribe(long uid)
    {
        var set = subs.GetOrAdd(uid, _ => new());
        if (set.Count >= MaxPerUser) return null;
        var ch = Channel.CreateBounded<string>(
            new BoundedChannelOptions(16) { FullMode = BoundedChannelFullMode.DropOldest });
        var id = Guid.NewGuid();
        set[id] = ch;
        return (id, ch.Reader);
    }

    public void Unsubscribe(long uid, Guid id)
    {
        if (subs.TryGetValue(uid, out var s)) s.TryRemove(id, out _);
    }

    public void Publish(long uid, string evt)
    {
        if (subs.TryGetValue(uid, out var s))
            foreach (var ch in s.Values) ch.Writer.TryWrite(evt);
    }

    // Ends every open stream of the user (used after disabling).
    public void Close(long uid)
    {
        if (subs.TryRemove(uid, out var s))
            foreach (var ch in s.Values) ch.Writer.TryComplete();
    }
}