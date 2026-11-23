using Xunit;

public class UserEventsTests
{
    static readonly TimeSpan Timeout = TimeSpan.FromSeconds(2);

    static void Fill(UserEvents ev, long uid, int n, List<Guid>? ids = null)
    {
        for (var i = 0; i < n; i++)
        {
            var s = ev.Subscribe(uid);
            Assert.NotNull(s);
            ids?.Add(s!.Value.id);
        }
    }

    [Fact]
    public void Subscribe_ReturnsNullAfterFive_OtherUserUnaffected()
    {
        var ev = new UserEvents();
        Fill(ev, 1, 5);
        Assert.Null(ev.Subscribe(1));
        Assert.NotNull(ev.Subscribe(2));
    }

    [Fact]
    public void Subscribe_Concurrent_YieldsExactlyFive()
    {
        var ev = new UserEvents();
        var ok = 0;
        Parallel.For(0, 100, _ =>
        {
            if (ev.Subscribe(1) != null) Interlocked.Increment(ref ok);
        });
        Assert.Equal(5, ok);
    }

    [Fact]
    public void Unsubscribe_All_ThenResubscribe_LimitStillApplies()
    {
        var ev = new UserEvents();
        var ids = new List<Guid>();
        Fill(ev, 1, 5, ids);
        foreach (var id in ids) ev.Unsubscribe(1, id);

        Fill(ev, 1, 5);
        Assert.Null(ev.Subscribe(1));
    }

    [Fact]
    public async Task Publish_DeliversToEverySubscriberOfThatUserOnly()
    {
        var ev = new UserEvents();
        var a = ev.Subscribe(1)!.Value;
        var b = ev.Subscribe(1)!.Value;
        var other = ev.Subscribe(2)!.Value;

        ev.Publish(1, "hello");

        Assert.True(a.reader.TryRead(out var ma));
        Assert.Equal("hello", ma);
        Assert.True(b.reader.TryRead(out var mb));
        Assert.Equal("hello", mb);
        Assert.False(other.reader.TryRead(out _));
        await Task.CompletedTask;
    }

    [Fact]
    public async Task Close_CompletesReaders_AndSubscribeAfterCloseSucceeds()
    {
        var ev = new UserEvents();
        var a = ev.Subscribe(1)!.Value;
        var b = ev.Subscribe(1)!.Value;

        ev.Close(1);

        await a.reader.Completion.WaitAsync(Timeout);
        Assert.False(await b.reader.WaitToReadAsync().AsTask().WaitAsync(Timeout));

        Fill(ev, 1, 5);
        Assert.Null(ev.Subscribe(1));
    }

    [Fact]
    public void Unsubscribe_Unknown_DoesNotThrow()
    {
        var ev = new UserEvents();
        ev.Unsubscribe(42, Guid.NewGuid());
        Fill(ev, 1, 1);
        ev.Unsubscribe(1, Guid.NewGuid());
        ev.Unsubscribe(2, Guid.NewGuid());
    }
}
