from app.guard import numbers_in, unsupported_numbers


def test_same_number_different_spellings():
    assert numbers_in("13,036 PLN") == numbers_in("13 036 PLN") == numbers_in("13 036 PLN") == {"13036"}
    assert numbers_in("62.2") == numbers_in("62,2") == {"62.2"}
    assert numbers_in("64.0") == numbers_in("64") == {"64"}


def test_unsupported_number_is_found():
    facts = ["Rank 1: Alfa, score 64.0 out of 100."]
    assert unsupported_numbers("Alfa has 64 points.", facts) == set()
    assert unsupported_numbers("Alfa has 65 points.", facts) == {"65"}
