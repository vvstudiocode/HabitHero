namespace HabitHero.Platform
{
    public interface ISupabaseSessionStore
    {
        string Load();

        void Save(string serializedSession);

        void Clear();
    }

    public sealed class InMemorySupabaseSessionStore : ISupabaseSessionStore
    {
        private string serializedSession;

        public string Load()
        {
            return serializedSession;
        }

        public void Save(string value)
        {
            serializedSession = value;
        }

        public void Clear()
        {
            serializedSession = null;
        }
    }
}
